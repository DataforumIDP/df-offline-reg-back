import { Request, Response } from "express";
import Excel from "exceljs";
import { scannerLogsDAL } from "../dal/scannersDAL";
import { zonesDAL } from "../dal/zonesDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { participantLogsDAL } from "../dal/participantLogsDAL";
import { ScannerLog } from "../models/scanners";
import { Zone } from "../models/zones";
import { ProjectField } from "../models/projectFields";
import { Participant } from "../models/participants";
import { Project, ScanMode } from "../models/projects";
import { wrap } from "../utils/wrap";
import { dbError, errorSend } from "../utils/errors";
import { formatPhone, getPhoneFieldKeys } from "../utils/phoneUtils";

const fieldDAL = new ProjectFieldsDAL();
const participantDAL = new ParticipantsDAL();

// Интерфейс запроса экспорта
interface ScanExportRequest {
    keys?: string[];           // Ключи схемы для выборки
    zones?: number[];          // ID зон для фильтрации
    filter?: Record<string, any>[]; // Фильтры по полям
    timeRange?: string[];      // [startISO, endISO]
    addPrints?: boolean;       // Включать количество печатей
    inclusive?: boolean;       // Включать участников, которые уже находились в зоне до начала периода
}

// Интерфейс для массовой выгрузки
interface MassExportItem {
    date: string;              // Дата в формате DD.MM.YYYY
    time: string;              // Время в формате HH:MM-HH:MM
    zone: string;              // Название зала/зоны
    title: string;             // Название листа (макс 31 символ)
}

interface MassExportRequest {
    items: MassExportItem[];
    keys?: string[];           // Ключи схемы для выборки
    addPrints?: boolean;       // Включать количество печатей
    inclusive?: boolean;       // Включать участников, которые уже находились в зоне до начала периода
}

// Интерфейс сессии пользователя
interface UserSession {
    zoneId: number;
    zoneName: string;
    start: Date;
    end: Date | null;
    durationMinutes: number;
}

// Интерфейс агрегированных данных пользователя
interface UserScanData {
    userCode: string;
    participant: Participant | null;
    sessions: UserSession[];
    totalMinutes: number;
    printCount: number;
}

// Константа для неопределённой длительности сессии (45 минут)
const DEFAULT_SESSION_MINUTES = 45;

/**
 * Сервис экспорта статистики сканирований
 */
class ScanExportService {
    /**
     * Загружает всех участников проекта и строит Map: code -> Participant
     * для всех полей типа 'code'. Один SQL-запрос вместо N.
     */
    private async buildCodeToParticipantMap(
        projectId: number,
        codeFieldKeys: string[]
    ): Promise<Map<string, Participant>> {
        const codeMap = new Map<string, Participant>();
        if (codeFieldKeys.length === 0) return codeMap;

        // Один запрос — все участники проекта
        const [participants] = await wrap(
            participantDAL.getActiveByProject(projectId)
        );

        if (!participants) return codeMap;

        for (const p of participants) {
            for (const key of codeFieldKeys) {
                const val = p.data?.[key];
                if (val !== undefined && val !== null && val !== '') {
                    codeMap.set(String(val), p);
                }
            }
        }

        return codeMap;
    }

    /**
     * POST /projects/:projectId/scans/excel
     * Экспорт статистики сканирований в Excel
     */
    async exportScansToExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const project = req.appValues?.project as Project;

        if (!project) {
            return errorSend(res, { message: "Проект не найден" });
        }

        const body: ScanExportRequest = req.body || {};
        const { keys = [], zones: zoneIds, filter, timeRange, addPrints = false, inclusive = false } = body;

        // 1. Получаем зоны проекта
        const [allZones, zonesErr] = await wrap(zonesDAL.getByProjectId(projectId));
        if (zonesErr || !allZones) {
            return dbError(res, "#SCANEXPORT1");
        }

        // Фильтруем зоны если указаны конкретные
        const zones = zoneIds && zoneIds.length > 0
            ? allZones.filter(z => zoneIds.includes(z.id))
            : allZones;

        if (zones.length === 0) {
            return errorSend(res, { message: "Нет доступных зон для экспорта" });
        }

        const zoneMap = new Map<number, Zone>(zones.map(z => [z.id, z]));
        const isSingleZone = zones.length === 1;

        // 2. Получаем схему полей проекта
        const [fields, fieldsErr] = await wrap(fieldDAL.getByProjectId(projectId));
        if (fieldsErr || !fields) {
            return dbError(res, "#SCANEXPORT2");
        }

        // Определяем поля типа code для поиска участников
        const codeFieldKeys = fields
            .filter(f => f.config.type === 'code')
            .map(f => f.key);

        if (codeFieldKeys.length === 0) {
            return errorSend(res, { message: "В проекте нет полей типа 'code' для связи сканов с участниками" });
        }

        // Фильтруем запрошенные ключи
        const selectedFields = keys.length > 0
            ? fields.filter(f => keys.includes(f.key))
            : fields;

        // 3. Парсим временной диапазон
        let timeStart: Date | undefined;
        let timeEnd: Date | undefined;
        if (timeRange && timeRange.length === 2) {
            timeStart = new Date(timeRange[0]);
            timeEnd = new Date(timeRange[1]);
        }

        // 4. Получаем логи сканеров
        // Если inclusive=true, расширяем выборку на 24 часа назад для захвата тех, кто уже был в зоне
        const INCLUSIVE_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 часа
        const queryTimeStart = inclusive && timeStart
            ? new Date(timeStart.getTime() - INCLUSIVE_LOOKBACK_MS)
            : timeStart;

        const [logs, logsErr] = await wrap(scannerLogsDAL.getLogsForExport({
            projectId,
            zoneIds: zones.map(z => z.id),
            timeStart: queryTimeStart,
            timeEnd,
        }));

        if (logsErr || !logs) {
            return dbError(res, "#SCANEXPORT3");
        }

        if (logs.length === 0) {
            return errorSend(res, { message: "Нет данных сканирований за выбранный период" });
        }

        // 5. Группируем логи по user_code
        const logsByUser = new Map<string, ScannerLog[]>();
        for (const log of logs) {
            const userLogs = logsByUser.get(log.user_code) || [];
            userLogs.push(log);
            logsByUser.set(log.user_code, userLogs);
        }

        // 6. Получаем участников — один запрос вместо N
        const participantMap = await this.buildCodeToParticipantMap(projectId, codeFieldKeys);

        // 7. Получаем количество печатей если нужно
        const printCounts = new Map<number, number>();
        if (addPrints) {
            const [counts, countsErr] = await wrap(participantLogsDAL.getPrintCountsByParticipant(projectId));
            if (!countsErr && counts) {
                for (const [pId, count] of counts) {
                    printCounts.set(pId, count);
                }
            }
        }

        // 8. Вычисляем сессии для каждого пользователя
        const scanMode = project.scanMode || project.scan_mode || 'base';
        const userScanData: UserScanData[] = [];
        
        // Определяем, все ли логи в один день (для форматирования)
        const allDates = logs.map(l => this.getDateKey(l.timestamp));
        const uniqueDates = new Set(allDates);
        const isSingleDay = uniqueDates.size === 1;

        for (const [userCode, userLogs] of logsByUser) {
            const participant = participantMap.get(userCode) || null;

            // Применяем фильтры по полям участника
            if (filter && filter.length > 0 && participant) {
                let passFilter = true;
                for (const f of filter) {
                    for (const [key, value] of Object.entries(f)) {
                        const participantValue = participant.data[key];
                        if (Array.isArray(value)) {
                            if (!value.includes(participantValue)) {
                                passFilter = false;
                                break;
                            }
                        } else if (participantValue !== value) {
                            passFilter = false;
                            break;
                        }
                    }
                    if (!passFilter) break;
                }
                if (!passFilter) continue;
            }

            // Вычисляем сессии
            let sessions = this.calculateSessions(
                userLogs,
                zoneMap,
                scanMode === 'direction'
            );

            // Если inclusive=true и есть timeRange, обрезаем сессии по границам
            if (inclusive && timeStart && timeEnd) {
                sessions = this.trimSessionsToTimeRange(
                    sessions,
                    timeStart,
                    timeEnd,
                    zoneIds && zoneIds.length > 0 ? zoneIds : undefined
                );
            }

            // Пропускаем пользователей без сессий в указанном диапазоне
            if (sessions.length === 0) {
                continue;
            }

            const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
            const printCount = participant && addPrints
                ? (printCounts.get(participant.id) || 0)
                : 0;

            userScanData.push({
                userCode,
                participant,
                sessions,
                totalMinutes,
                printCount,
            });
        }

        if (userScanData.length === 0) {
            return errorSend(res, { message: "Нет данных после применения фильтров" });
        }

        // 9. Формируем Excel
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet("Статистика сканирований");

        // Заголовки колонок
        const columns: Excel.Column[] = [];

        // Колонки данных участника
        for (const field of selectedFields) {
            columns.push({
                header: field.label,
                key: field.key,
                width: 20,
            } as Excel.Column);
        }

        // Колонка сессий
        columns.push({
            header: "Время сессий",
            key: "_sessions",
            width: 60,
        } as Excel.Column);

        // Колонка общего времени
        columns.push({
            header: "Общее время",
            key: "_total_time",
            width: 15,
        } as Excel.Column);

        // Колонка печатей (если включена)
        if (addPrints) {
            columns.push({
                header: "Печати",
                key: "_prints",
                width: 10,
            } as Excel.Column);
        }

        worksheet.columns = columns;

        // Получаем ключи телефонных полей для форматирования
        const phoneFieldKeys = getPhoneFieldKeys(fields as any);

        // Добавляем строки
        for (const userData of userScanData) {
            const row: Record<string, any> = {};

            // Данные участника
            for (const field of selectedFields) {
                let value = userData.participant?.data[field.key];
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                // Форматируем телефоны для экспорта
                if (phoneFieldKeys.includes(field.key) && value) {
                    value = formatPhone(value);
                }
                row[field.key] = value || '';
            }

            // Форматируем сессии
            row._sessions = this.formatSessions(userData.sessions, isSingleZone, isSingleDay);

            // Форматируем общее время
            row._total_time = this.formatDuration(userData.totalMinutes);

            // Печати
            if (addPrints) {
                row._prints = userData.printCount;
            }

            worksheet.addRow(row);
        }

        // Стилизация заголовков
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        // Отправляем файл
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=scans_${projectId}_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Вычисление сессий для пользователя с общим таймлайном
     * Если пользователь пикнулся в другой зоне - завершает предыдущую сессию
     * Сессии НЕ переходят через полночь - каждый день рассчитывается отдельно
     * @param logs - логи сканирований пользователя (все зоны)
     * @param zoneMap - карта зон
     * @param useDirections - использовать направления (in/out) или нечёт/чёт
     */
    private calculateSessions(
        logs: ScannerLog[],
        zoneMap: Map<number, Zone>,
        useDirections: boolean
    ): UserSession[] {
        // Разбиваем логи по UTC дням
        const logsByDay = new Map<string, ScannerLog[]>();
        for (const log of logs) {
            const dayKey = this.getDateKey(log.timestamp);
            const dayLogs = logsByDay.get(dayKey) || [];
            dayLogs.push(log);
            logsByDay.set(dayKey, dayLogs);
        }

        // Рассчитываем сессии для каждого дня отдельно
        const allSessions: UserSession[] = [];
        for (const [, dayLogs] of logsByDay) {
            const daySessions = this.calculateSessionsForDay(dayLogs, zoneMap, useDirections);
            allSessions.push(...daySessions);
        }

        // Сортируем по времени начала
        allSessions.sort((a, b) => a.start.getTime() - b.start.getTime());

        return allSessions;
    }

    /**
     * Вычисление сессий для одного дня
     */
    private calculateSessionsForDay(
        logs: ScannerLog[],
        zoneMap: Map<number, Zone>,
        useDirections: boolean
    ): UserSession[] {
        // Сортируем ВСЕ логи по времени (общий таймлайн)
        const sortedLogs = [...logs].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const sessions: UserSession[] = [];
        
        // Текущая открытая сессия
        let currentSession: {
            zoneId: number;
            zoneName: string;
            start: Date;
            lastActivity: Date;
        } | null = null;

        for (const log of sortedLogs) {
            const logTime = new Date(log.timestamp);
            const zone = zoneMap.get(log.zone_id);
            const zoneName = zone?.name || `Зона ${log.zone_id}`;

            if (useDirections) {
                // Режим с направлениями in/out
                if (log.direction === 'in') {
                    // Вход в зону - закрываем предыдущую сессию если есть
                    if (currentSession) {
                        const duration = Math.round(
                            (logTime.getTime() - currentSession.start.getTime()) / 60000
                        );
                        sessions.push({
                            zoneId: currentSession.zoneId,
                            zoneName: currentSession.zoneName,
                            start: currentSession.start,
                            end: logTime,
                            durationMinutes: duration > 0 ? duration : 0,
                        });
                    }
                    // Начинаем новую сессию
                    currentSession = {
                        zoneId: log.zone_id,
                        zoneName,
                        start: logTime,
                        lastActivity: logTime,
                    };
                } else if (log.direction === 'out') {
                    // Выход из зоны
                    if (currentSession && currentSession.zoneId === log.zone_id) {
                        // Выход из текущей зоны - закрываем сессию
                        const duration = Math.round(
                            (logTime.getTime() - currentSession.start.getTime()) / 60000
                        );
                        sessions.push({
                            zoneId: currentSession.zoneId,
                            zoneName: currentSession.zoneName,
                            start: currentSession.start,
                            end: logTime,
                            durationMinutes: duration > 0 ? duration : 0,
                        });
                        currentSession = null;
                    } else if (!currentSession) {
                        // Выход без входа - 45 минут до выхода
                        const startTime = new Date(logTime.getTime() - DEFAULT_SESSION_MINUTES * 60000);
                        sessions.push({
                            zoneId: log.zone_id,
                            zoneName,
                            start: startTime,
                            end: logTime,
                            durationMinutes: DEFAULT_SESSION_MINUTES,
                        });
                    }
                    // Если выход из другой зоны - игнорируем
                }
            } else {
                // Режим без направлений - любой скан считается активностью
                // Если скан в другой зоне - закрываем предыдущую сессию
                if (currentSession && currentSession.zoneId !== log.zone_id) {
                    const duration = Math.round(
                        (logTime.getTime() - currentSession.start.getTime()) / 60000
                    );
                    sessions.push({
                        zoneId: currentSession.zoneId,
                        zoneName: currentSession.zoneName,
                        start: currentSession.start,
                        end: logTime,
                        durationMinutes: duration > 0 ? duration : 0,
                    });
                    // Начинаем новую сессию в новой зоне
                    currentSession = {
                        zoneId: log.zone_id,
                        zoneName,
                        start: logTime,
                        lastActivity: logTime,
                    };
                } else if (!currentSession) {
                    // Первый скан - начинаем сессию
                    currentSession = {
                        zoneId: log.zone_id,
                        zoneName,
                        start: logTime,
                        lastActivity: logTime,
                    };
                } else {
                    // Скан в той же зоне - обновляем lastActivity
                    currentSession.lastActivity = logTime;
                }
            }
        }

        // Закрываем последнюю открытую сессию (45 минут от начала)
        if (currentSession) {
            const endTime = new Date(currentSession.start.getTime() + DEFAULT_SESSION_MINUTES * 60000);
            sessions.push({
                zoneId: currentSession.zoneId,
                zoneName: currentSession.zoneName,
                start: currentSession.start,
                end: endTime,
                durationMinutes: DEFAULT_SESSION_MINUTES,
            });
        }

        // Сортируем по времени начала
        sessions.sort((a, b) => a.start.getTime() - b.start.getTime());

        return sessions;
    }

    /**
     * Обрезает сессии по временным границам и пересчитывает длительность
     * Используется для режима inclusive - включает тех, кто уже был в зоне
     * @param sessions - исходные сессии
     * @param timeStart - начало периода
     * @param timeEnd - конец периода
     * @param zoneIds - ID зон для фильтрации (если указаны)
     */
    private trimSessionsToTimeRange(
        sessions: UserSession[],
        timeStart: Date,
        timeEnd: Date,
        zoneIds?: number[]
    ): UserSession[] {
        const trimmed: UserSession[] = [];

        for (const session of sessions) {
            // Фильтруем по зонам если указаны
            if (zoneIds && zoneIds.length > 0 && !zoneIds.includes(session.zoneId)) {
                continue;
            }

            const sessionStart = session.start.getTime();
            const sessionEnd = session.end ? session.end.getTime() : sessionStart + DEFAULT_SESSION_MINUTES * 60000;
            const rangeStart = timeStart.getTime();
            const rangeEnd = timeEnd.getTime();

            // Сессия полностью вне диапазона - пропускаем
            if (sessionEnd <= rangeStart || sessionStart >= rangeEnd) {
                continue;
            }

            // Обрезаем сессию по границам
            const clippedStart = new Date(Math.max(sessionStart, rangeStart));
            const clippedEnd = new Date(Math.min(sessionEnd, rangeEnd));
            const durationMinutes = Math.round((clippedEnd.getTime() - clippedStart.getTime()) / 60000);

            if (durationMinutes > 0) {
                trimmed.push({
                    ...session,
                    start: clippedStart,
                    end: clippedEnd,
                    durationMinutes,
                });
            }
        }

        return trimmed;
    }

    /**
     * Старая логика - сессии по зонам независимо (не используется)
     */
    private calculateSessionsOld(
        logs: ScannerLog[],
        zoneMap: Map<number, Zone>,
        useDirections: boolean
    ): UserSession[] {
        const sessions: UserSession[] = [];

        // Группируем логи по зоне и дню (UTC+3)
        const logsByZoneAndDay = new Map<string, ScannerLog[]>();
        for (const log of logs) {
            const dateKey = this.getDateKey(log.timestamp);
            const key = `${log.zone_id}_${dateKey}`;
            const arr = logsByZoneAndDay.get(key) || [];
            arr.push(log);
            logsByZoneAndDay.set(key, arr);
        }

        for (const [key, zoneLogs] of logsByZoneAndDay) {
            const zoneId = parseInt(key.split('_')[0], 10);
            const zone = zoneMap.get(zoneId);
            const zoneName = zone?.name || `Зона ${zoneId}`;

            // Сортируем по времени
            zoneLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            if (useDirections) {
                // Режим с направлениями
                const zoneSessions = this.calculateDirectionSessions(zoneLogs, zoneName);
                sessions.push(...zoneSessions);
            } else {
                // Режим без направлений (нечёт = вход, чёт = выход)
                const zoneSessions = this.calculateAlternatingSessions(zoneLogs, zoneName);
                sessions.push(...zoneSessions);
            }
        }

        // Сортируем все сессии по времени начала
        sessions.sort((a, b) => a.start.getTime() - b.start.getTime());

        return sessions;
    }

    /**
     * Вычисление сессий в режиме с направлениями (in/out)
     */
    private calculateDirectionSessions(logs: ScannerLog[], zoneName: string): UserSession[] {
        const sessions: UserSession[] = [];
        let currentEntry: Date | null = null;

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const logTime = new Date(log.timestamp);

            if (log.direction === 'in') {
                // Вход - начинаем новую сессию если нет активной
                if (!currentEntry) {
                    currentEntry = logTime;
                }
                // Если уже есть вход - игнорируем повторный вход
            } else if (log.direction === 'out') {
                // Выход
                if (currentEntry) {
                    // Есть парный вход - создаём сессию
                    const duration = Math.round((logTime.getTime() - currentEntry.getTime()) / 60000);
                    sessions.push({
                        zoneId: log.zone_id,
                        zoneName,
                        start: currentEntry,
                        end: logTime,
                        durationMinutes: duration > 0 ? duration : 0,
                    });
                    currentEntry = null;
                } else {
                    // Выход без входа - 45 минут до выхода
                    const startTime = new Date(logTime.getTime() - DEFAULT_SESSION_MINUTES * 60000);
                    sessions.push({
                        zoneId: log.zone_id,
                        zoneName,
                        start: startTime,
                        end: logTime,
                        durationMinutes: DEFAULT_SESSION_MINUTES,
                    });
                }
            }
        }

        // Если остался незакрытый вход - 45 минут от входа
        if (currentEntry) {
            const endTime = new Date(currentEntry.getTime() + DEFAULT_SESSION_MINUTES * 60000);
            sessions.push({
                zoneId: logs[logs.length - 1].zone_id,
                zoneName,
                start: currentEntry,
                end: endTime,
                durationMinutes: DEFAULT_SESSION_MINUTES,
            });
        }

        return sessions;
    }

    /**
     * Вычисление сессий в режиме без направлений (нечёт = вход, чёт = выход)
     */
    private calculateAlternatingSessions(logs: ScannerLog[], zoneName: string): UserSession[] {
        const sessions: UserSession[] = [];

        for (let i = 0; i < logs.length; i += 2) {
            const entryLog = logs[i];
            const exitLog = logs[i + 1];
            const entryTime = new Date(entryLog.timestamp);

            if (exitLog) {
                // Есть и вход и выход
                const exitTime = new Date(exitLog.timestamp);
                const duration = Math.round((exitTime.getTime() - entryTime.getTime()) / 60000);
                sessions.push({
                    zoneId: entryLog.zone_id,
                    zoneName,
                    start: entryTime,
                    end: exitTime,
                    durationMinutes: duration > 0 ? duration : 0,
                });
            } else {
                // Только вход - 45 минут
                const endTime = new Date(entryTime.getTime() + DEFAULT_SESSION_MINUTES * 60000);
                sessions.push({
                    zoneId: entryLog.zone_id,
                    zoneName,
                    start: entryTime,
                    end: endTime,
                    durationMinutes: DEFAULT_SESSION_MINUTES,
                });
            }
        }

        return sessions;
    }

    /**
     * Получить ключ даты в UTC+3 (Москва)
     */
    private getDateKey(timestamp: Date | string): string {
        const date = new Date(timestamp);
        // Добавляем 3 часа для UTC+3
        const moscowDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
        return moscowDate.toISOString().split('T')[0];
    }

    /**
     * Форматирование времени в UTC+3
     */
    private formatTime(date: Date): string {
        const moscowDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
        const hours = moscowDate.getUTCHours().toString().padStart(2, '0');
        const minutes = moscowDate.getUTCMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * Форматирование даты в UTC+3
     */
    private formatDate(date: Date): string {
        const moscowDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
        const day = moscowDate.getUTCDate().toString().padStart(2, '0');
        const month = (moscowDate.getUTCMonth() + 1).toString().padStart(2, '0');
        const year = moscowDate.getUTCFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Форматирование списка сессий для ячейки Excel
     */
    private formatSessions(sessions: UserSession[], isSingleZone: boolean, isSingleDay: boolean): string {
        if (sessions.length === 0) return '';

        return sessions.map(s => {
            const startTime = this.formatTime(s.start);
            const endTime = s.end ? this.formatTime(s.end) : '?';
            let result = `${startTime}-${endTime}`;

            // Добавляем дату если несколько дней
            if (!isSingleDay) {
                result += ` ${this.formatDate(s.start)}`;
            }

            // Добавляем зону если несколько зон
            if (!isSingleZone) {
                result += ` (${s.zoneName})`;
            }

            return result;
        }).join('; ');
    }

    /**
     * Форматирование общей длительности
     */
    private formatDuration(minutes: number): string {
        if (minutes < 60) {
            return `${minutes}м`;
        }
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
    }

    /**
     * POST /projects/:projectId/scanners/logs/mass
     * Массовая выгрузка сканов по списку из Excel
     */
    async exportMassScansToExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const project = req.appValues?.project as Project;

        if (!project) {
            return errorSend(res, { message: "Проект не найден" });
        }

        const body: MassExportRequest = req.body || {};
        const { items = [], keys = [], addPrints = false, inclusive = false } = body;

        if (!items || items.length === 0) {
            return errorSend(res, { message: "Список для выгрузки пуст" });
        }

        // Константа для lookback при inclusive
        const INCLUSIVE_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 часа

        // 1. Получаем все зоны проекта
        const [allZones, zonesErr] = await wrap(zonesDAL.getByProjectId(projectId));
        if (zonesErr || !allZones) {
            return dbError(res, "#SCANEXPORT_MASS1");
        }

        const zoneByName = new Map<string, Zone>();
        for (const zone of allZones) {
            zoneByName.set(zone.name.trim().toLowerCase(), zone);
        }

        // 2. Получаем схему полей проекта
        const [fields, fieldsErr] = await wrap(fieldDAL.getByProjectId(projectId));
        if (fieldsErr || !fields) {
            return dbError(res, "#SCANEXPORT_MASS2");
        }

        const codeFieldKeys = fields
            .filter(f => f.config.type === 'code')
            .map(f => f.key);

        if (codeFieldKeys.length === 0) {
            return errorSend(res, { message: "В проекте нет полей типа 'code'" });
        }

        const selectedFields = keys.length > 0
            ? fields.filter(f => keys.includes(f.key))
            : fields;

        // Получаем ключи телефонных полей для форматирования
        const phoneFieldKeys = getPhoneFieldKeys(fields as any);

        // 3. Предзагрузка всех участников проекта (один SQL-запрос вместо N*M)
        const globalParticipantMap = await this.buildCodeToParticipantMap(projectId, codeFieldKeys);
        console.log('[MassExport] Предзагрузка участников:', globalParticipantMap.size, 'кодов');

        // 4. Получаем количество печатей если нужно
        const printCounts = new Map<number, number>();
        if (addPrints) {
            const [counts, countsErr] = await wrap(participantLogsDAL.getPrintCountsByParticipant(projectId));
            if (!countsErr && counts) {
                for (const [pId, count] of counts) {
                    printCounts.set(pId, count);
                }
            }
        }

        // 5. Обрабатываем каждый item и формируем Excel
        const workbook = new Excel.Workbook();
        const scanMode = project.scanMode || project.scan_mode || 'base';

        for (const item of items) {
            // Проверяем наличие обязательных полей
            if (!item.date || !item.time || !item.zone) {
                console.log('[MassExport] Пропуск строки - отсутствуют обязательные поля:', { date: item.date, time: item.time, zone: item.zone });
                continue; // Пропускаем если нет даты, времени или зоны
            }

            // Парсим дату и время с валидацией формата
            const dateParts = item.date.split('.');
            if (dateParts.length !== 3) {
                console.log('[MassExport] Пропуск строки - неверный формат даты:', item.date);
                continue; // Неверный формат даты
            }
            const [day, month, year] = dateParts.map(Number);

            // Поддержка разных типов тире: обычное -, среднее – (en dash), длинное — (em dash)
            const timeNormalized = item.time.replace(/[–—]/g, '-').trim();
            const timeParts = timeNormalized.split('-');
            if (timeParts.length !== 2) {
                console.log('[MassExport] Пропуск строки - неверный формат времени:', item.time, '-> normalized:', timeNormalized);
                continue; // Неверный формат времени
            }
            const [timeStart, timeEnd] = timeParts.map(s => s.trim());

            const timeStartParts = timeStart.split(':');
            const timeEndParts = timeEnd.split(':');
            if (timeStartParts.length < 2 || timeEndParts.length < 2) {
                console.log('[MassExport] Пропуск строки - неверный формат времени (нет минут):', { timeStart, timeEnd });
                continue; // Неверный формат времени
            }
            const [startHour, startMin] = timeStartParts.map(Number);
            const [endHour, endMin] = timeEndParts.map(Number);

            // Создаём даты в UTC, компенсируя Moscow UTC+3
            // Пользователь вводит московское время, а в БД хранится UTC
            const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
            const dateStart = new Date(Date.UTC(year, month - 1, day, startHour, startMin) - MOSCOW_OFFSET_MS);
            const dateEnd = new Date(Date.UTC(year, month - 1, day, endHour, endMin) - MOSCOW_OFFSET_MS);

            // Находим зону по имени (также проверяем без суффикса после ::)
            let zoneName = item.zone.trim().toLowerCase();
            let zone = zoneByName.get(zoneName);
            
            // Если зона не найдена и есть ::, пробуем без суффикса
            if (!zone && zoneName.includes('::')) {
                const zoneNameWithoutSuffix = zoneName.split('::')[0];
                zone = zoneByName.get(zoneNameWithoutSuffix);
                if (zone) {
                    console.log('[MassExport] Зона найдена без суффикса:', { original: item.zone, matched: zone.name });
                }
            }
            
            if (!zone) {
                console.log('[MassExport] Пропуск строки - зона не найдена:', item.zone, 'Доступные зоны:', Array.from(zoneByName.keys()));
                continue; // Пропускаем если зона не найдена
            }

            // Получаем логи для этой зоны и времени
            // Если inclusive=true, расширяем выборку на 24 часа назад
            const queryTimeStart = inclusive
                ? new Date(dateStart.getTime() - INCLUSIVE_LOOKBACK_MS)
                : dateStart;

            const [logs, logsErr] = await wrap(scannerLogsDAL.getLogsForExport({
                projectId,
                zoneIds: [zone.id],
                timeStart: queryTimeStart,
                timeEnd: dateEnd,
            }));

            if (logsErr || !logs || logs.length === 0) {
                console.log('[MassExport] Пропуск строки - нет логов:', { 
                    zone: zone.name, 
                    zoneId: zone.id,
                    dateStart: dateStart.toISOString(), 
                    dateEnd: dateEnd.toISOString(),
                    queryTimeStart: queryTimeStart.toISOString(),
                    logsErr: logsErr?.message,
                    logsCount: logs?.length || 0
                });
                continue; // Пропускаем если нет логов
            }

            console.log('[MassExport] Найдено логов:', logs.length, 'для зоны:', zone.name, 'период:', dateStart.toISOString(), '-', dateEnd.toISOString());

            // Группируем логи по user_code
            const logsByUser = new Map<string, ScannerLog[]>();
            for (const log of logs) {
                const userLogs = logsByUser.get(log.user_code) || [];
                userLogs.push(log);
                logsByUser.set(log.user_code, userLogs);
            }

            // Вычисляем сессии
            const zoneMap = new Map<number, Zone>([[zone.id, zone]]);
            const userScanData: UserScanData[] = [];

            for (const [userCode, userLogs] of logsByUser) {
                const participant = globalParticipantMap.get(userCode) || null;
                let sessions = this.calculateSessions(
                    userLogs,
                    zoneMap,
                    scanMode === 'direction'
                );

                // Если inclusive=true, обрезаем сессии по границам периода
                if (inclusive) {
                    sessions = this.trimSessionsToTimeRange(
                        sessions,
                        dateStart,
                        dateEnd,
                        [zone.id]
                    );
                }

                // Пропускаем пользователей без сессий в указанном диапазоне
                if (sessions.length === 0) {
                    continue;
                }

                const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
                const printCount = participant && addPrints
                    ? (printCounts.get(participant.id) || 0)
                    : 0;

                userScanData.push({
                    userCode,
                    participant,
                    sessions,
                    totalMinutes,
                    printCount,
                });
            }

            if (userScanData.length === 0) {
                console.log('[MassExport] Пропуск строки - нет данных после обработки сессий:', { 
                    zone: zone.name, 
                    title: item.title,
                    logsCount: logs.length,
                    uniqueUsers: logsByUser.size
                });
                continue; // Пропускаем если нет данных
            }

            console.log('[MassExport] Создаём лист:', item.title, 'участников:', userScanData.length);

            // Создаём лист (название макс 31 символ, без запрещённых символов)
            let sheetName = item.title
                .replace(/[\\/*?:\[\]]/g, '') // Убираем запрещённые Excel символы
                .substring(0, 31)
                .trim();
            
            // Дедупликация: если лист с таким именем уже есть, добавляем суффикс
            const existingNames = new Set(workbook.worksheets.map(ws => ws.name));
            if (existingNames.has(sheetName)) {
                let suffix = 2;
                while (existingNames.has(sheetName.substring(0, 28) + ` (${suffix})`)) {
                    suffix++;
                }
                sheetName = sheetName.substring(0, 28) + ` (${suffix})`;
            }
            
            const worksheet = workbook.addWorksheet(sheetName);

            // Заголовки колонок
            const columns: Excel.Column[] = [];

            for (const field of selectedFields) {
                columns.push({
                    header: field.label,
                    key: field.key,
                    width: 20,
                } as Excel.Column);
            }

            columns.push({
                header: "Время сессий",
                key: "_sessions",
                width: 60,
            } as Excel.Column);

            columns.push({
                header: "Общее время",
                key: "_total_time",
                width: 15,
            } as Excel.Column);

            if (addPrints) {
                columns.push({
                    header: "Печати",
                    key: "_prints",
                    width: 10,
                } as Excel.Column);
            }

            worksheet.columns = columns;

            // Добавляем строки
            for (const userData of userScanData) {
                const row: Record<string, any> = {};

                for (const field of selectedFields) {
                    let value = userData.participant?.data[field.key];
                    if (Array.isArray(value)) {
                        value = value.join(', ');
                    }
                    // Форматируем телефоны для экспорта
                    if (phoneFieldKeys.includes(field.key) && value) {
                        value = formatPhone(value);
                    }
                    row[field.key] = value || '';
                }

                row._sessions = this.formatSessions(userData.sessions, true, true);
                row._total_time = this.formatDuration(userData.totalMinutes);

                if (addPrints) {
                    row._prints = userData.printCount;
                }

                worksheet.addRow(row);
            }

            // Стилизация заголовков
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' },
            };
        }

        if (workbook.worksheets.length === 0) {
            return errorSend(res, { message: "Не удалось сформировать ни одного листа" });
        }

        // Отправляем файл
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=mass_scans_${projectId}_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }
}

export const scanExportService = new ScanExportService();
