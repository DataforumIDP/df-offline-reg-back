import { Request, Response } from "express";
import * as Excel from "exceljs";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { participantLogsDAL } from "../dal/participantLogsDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ParticipantHelper } from "../models/participants";
import { ProjectFieldConfig, ProjectFieldHelper } from "../models/projectFields";
import { dbError, errorSend } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { paginationResponse } from "../utils/paginationUtils";
import { normalizeParticipantPhones, formatParticipantPhones, getPhoneFieldKeys } from "../utils/phoneUtils";
import { runScript } from "../utils/scriptRunner";
import { db } from "../config/db";

const participantDAL = new ParticipantsDAL();
const fieldDAL = new ProjectFieldsDAL();

export class ParticipantService {
    /**
     * GET /projects/:projectId/participants
     * Получение списка участников проекта
     */
    async getAll(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        const [participants, meta] = await participantDAL.getByProjectId(projectId, req.query);

        if (!participants) {
            return dbError(res, "#GETPARTICIPANTS1");
        }

        res.json(
            paginationResponse({
                list: participants.map(ParticipantHelper.toJSON),
                all: meta.total,
                limit: req.query.limit as string,
                page: req.query.page as string,
            })
        );
    }

    /**
     * GET /projects/:projectId/participants/:participantId
     * Получение данных одного участника
     */
    async getOne(req: Request, res: Response) {
        const participant = req.participant!;
        res.json(ParticipantHelper.toJSON(participant));
    }

    /**
     * POST /projects/:projectId/participants
     * Добавление участника
     */
    async create(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const userId = req.account?.id || null;

        // Загружаем скрипты проекта
        const projectRow = await db("projects").where({ id: projectId }).first("pre_script", "post_script");
        const preScript: string | null = projectRow?.pre_script ?? null;
        const postScript: string | null = projectRow?.post_script ?? null;

        // Прескрипт: трансформация/валидация сырых данных до всей остальной обработки
        let data: Record<string, any> = { ...req.body };
        if (preScript) {
            try {
                data = await runScript(preScript, { user: data }, 'form');
            } catch (scriptErr: any) {
                return res.status(400).json({ success: false, error: scriptErr?.message ?? "Ошибка прескрипта" });
            }
        }

        // Получаем схему проекта для генерации автоматических полей
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (fields) {
            // Генерируем случайные значения для полей типа code с random: true
            for (const field of fields) {
                if (field.config.type === 'code' && field.config.random === true) {
                    // Генерируем только если значение не указано
                    if (data[field.key] === undefined || data[field.key] === '') {
                        data[field.key] = ProjectFieldHelper.generateRandomValue(field.config);
                    }
                }
            }

            // Применяем значения по умолчанию для полей с defaultValue
            for (const field of fields) {
                const config = field.config as any;
                if (config.defaultValue !== undefined) {
                    if (data[field.key] === undefined || data[field.key] === '') {
                        data[field.key] = config.defaultValue;
                    }
                }
            }

            // Генерируем ID для полей типа id
            for (const field of fields) {
                if (field.config.type === 'id') {
                    if (data[field.key] === undefined || data[field.key] === '') {
                        const [maxId] = await wrap(participantDAL.getMaxIdFieldValue(projectId, field.key));
                        data[field.key] = (maxId || 0) + 1;
                    }
                }
            }

            // Удаляем скрытые поля если пользователь — оператор
            const role = req.account?.role;
            if (role !== 'admin' && role !== 'superadmin') {
                for (const field of fields) {
                    if ((field.config as any).isHidden) {
                        delete data[field.key];
                    }
                }
            }

            // Нормализуем телефонные номера
            const phoneFieldKeys = getPhoneFieldKeys(fields as any);
            const normalizedData = normalizeParticipantPhones(data, phoneFieldKeys);
            Object.assign(data, normalizedData);
        }

        const [participant, err] = await wrap(participantDAL.create({
            project_id: projectId,
            data,
        }));

        if (err || !participant) {
            return dbError(res, "#CREATEPARTICIPANT1");
        }

        // Записываем в лог
        await participantLogsDAL.create({
            projectId,
            participantId: participant.id,
            action: "CREATE",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        // Постскрипт: обработка после сохранения
        let finalData = participant.data;
        if (postScript) {
            try {
                const result = await runScript(postScript, { user: participant.data }, 'form');
                const [updated] = await wrap(participantDAL.update(participant.id, result));
                if (updated) finalData = result;
            } catch (scriptErr: any) {
                console.error(`[PROJECT POST_SCRIPT form] projectId=${projectId} error:`, scriptErr?.message);
            }
        }

        response201(res, ParticipantHelper.toJSON({ ...participant, data: finalData }));
    }

    /**
     * PUT /projects/:projectId/participants/:participantId
     * Обновление данных участника
     */
    async update(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        let data = { ...req.body };
        const userId = req.account?.id || null;

        // Получаем схему проекта для нормализации телефонов
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (fields) {
            // Удаляем скрытые поля если пользователь — оператор
            const role = req.account?.role;
            if (role !== 'admin' && role !== 'superadmin') {
                for (const field of fields) {
                    if ((field.config as any).isHidden) {
                        delete data[field.key];
                    }
                }
            }

            const phoneFieldKeys = getPhoneFieldKeys(fields as any);
            data = normalizeParticipantPhones(data, phoneFieldKeys);
        }

        const [updated, err] = await wrap(participantDAL.update(participantId, data));

        if (err || !updated) {
            return dbError(res, "#UPDATEPARTICIPANT1");
        }

        // Записываем в лог с новыми данными
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "UPDATE",
            actor: "USER",
            userId,
            currentData: updated.data,
        });

        res.json(ParticipantHelper.toJSON(updated));
    }

    /**
     * DELETE /projects/:projectId/participants/:participantId
     * Удаление участника
     */
    async delete(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        const userId = req.account?.id || null;
        const participant = req.participant!;

        const [deleted, err] = await wrap(participantDAL.softDelete(participantId));

        if (err || !deleted) {
            return dbError(res, "#DELETEPARTICIPANT1");
        }

        // Записываем в лог данные на момент удаления
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "DELETE",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        response204(res);
    }

    /**
     * POST /projects/:projectId/participants/:participantId/print
     * Отметка о печати участника
     */
    async print(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        const userId = req.account?.id || null;
        const participant = req.participant!;

        // Записываем в лог
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "PRINT",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        res.json({ success: true, message: "Print logged" });
    }

    /**
     * GET /projects/:projectId/participants/excel
     * Получение шаблона Excel с ключами полей в первой строке
     */
    async getExcelTemplate(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields) {
            return dbError(res, "#EXCELTEMPLATE1");
        }

        // Фильтруем поля типа id (они генерируются автоматически)
        const editableFields = fields.filter(f => f.config.type !== 'id');

        if (editableFields.length === 0) {
            return errorSend(res, { message: "В проекте нет редактируемых полей" });
        }

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet("Участники");

        // Первая строка - ключи полей (key)
        worksheet.columns = editableFields.map(field => ({
            header: field.key,
            key: field.key,
            width: 20,
        }));

        // Вторая строка - подсказки (label и тип)
        const hintRow: Record<string, string> = {};
        editableFields.forEach(field => {
            const typeHint = getFieldTypeHint(field.config);
            hintRow[field.key] = `${field.label} (${typeHint})`;
        });
        worksheet.addRow(hintRow);

        // Стилизация
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

        // Отправляем файл
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=template_project_${projectId}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * POST /projects/:projectId/participants/excel
     * Импорт участников из Excel
     */
    async importFromExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const userId = req.account?.id || null;

        // Загружаем скрипты проекта
        const projectRow = await db("projects").where({ id: projectId }).first("pre_script", "post_script");
        const preScript: string | null = projectRow?.pre_script ?? null;
        const postScript: string | null = projectRow?.post_script ?? null;

        // Проверяем наличие файла
        if (!req.files || !req.files.file) {
            return errorSend(res, { message: "Файл не загружен" });
        }

        const file = req.files.file;
        if (Array.isArray(file)) {
            return errorSend(res, { message: "Ожидается один файл" });
        }

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields || fields.length === 0) {
            return errorSend(res, { message: "Схема проекта не настроена" });
        }

        // Создаём карту полей
        const fieldMap = new Map(fields.map(f => [f.key, f]));
        const editableFields = fields.filter(f => f.config.type !== 'id');

        // Читаем Excel
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(file.data as any);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            return errorSend(res, { message: "Файл не содержит листов" });
        }

        // Получаем заголовки из первой строки
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = String(cell.value || '').trim();
        });

        console.log('[Excel Import Debug]', {
            rowCount: worksheet.rowCount,
            actualRowCount: worksheet.actualRowCount,
            headers,
        });

        if (headers.length === 0) {
            return errorSend(res, { message: "Первая строка должна содержать ключи полей" });
        }

        // Валидация строк
        const errors: { row: number; field: string; message: string }[] = [];
        const validRows: Record<string, any>[] = [];

        // Начинаем со строки 2 (строка 1 - заголовки)
        // Если есть строка подсказок - она будет пропущена как не содержащая данных для полей
        const startRow = 2;
        for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const rowData: Record<string, any> = {};
            let hasData = false;

            // Обрабатываем каждую ячейку
            row.eachCell({ includeEmpty: false }, (cell, colNum) => {
                const key = headers[colNum];
                if (!key) return;

                // Пропускаем строку подсказок (содержит "(")
                const cellStr = String(cell.value || '');
                if (rowNum === 2 && cellStr.includes('(') && cellStr.includes(')')) {
                    return;
                }

                let value = cell.value;
                
                // Обработка формул и объектов
                if (typeof value === 'object' && value !== null) {
                    if ('result' in value) {
                        value = (value as any).result;
                    } else if ('text' in value) {
                        value = (value as any).text;
                    }
                }

                if (value !== null && value !== undefined && value !== '') {
                    hasData = true;
                    rowData[key] = value;
                }
            });

            console.log(`[Row ${rowNum}]`, { hasData, rowData });

            // Пропускаем пустые строки
            if (!hasData) continue;

            // Валидация данных строки
            const rowErrors = validateRowData(rowData, fieldMap, rowNum);
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
                continue;
            }

            // Генерируем ID поля
            for (const field of fields) {
                if (field.config.type === 'id') {
                    const [maxId] = await wrap(participantDAL.getMaxIdFieldValue(projectId, field.key));
                    rowData[field.key] = (maxId || 0) + validRows.length + 1;
                }
            }

            // Генерируем случайные значения для полей типа code с random: true
            for (const field of fields) {
                if (field.config.type === 'code' && field.config.random === true) {
                    // Генерируем только если значение не указано
                    if (rowData[field.key] === undefined || rowData[field.key] === '') {
                        rowData[field.key] = ProjectFieldHelper.generateRandomValue(field.config);
                    }
                }
            }

            // Применяем значения по умолчанию для полей с defaultValue
            for (const field of fields) {
                const config = field.config as any;
                if (config.defaultValue !== undefined) {
                    // Применяем только если значение не указано или пустое
                    if (rowData[field.key] === undefined || rowData[field.key] === '') {
                        rowData[field.key] = config.defaultValue;
                    }
                }
            }

            // Проверка уникальности
            for (const field of fields) {
                if (field.config.uniq && rowData[field.key] !== undefined) {
                    const [isUnique] = await wrap(
                        participantDAL.isFieldValueUnique(projectId, field.key, rowData[field.key])
                    );
                    if (!isUnique) {
                        errors.push({
                            row: rowNum,
                            field: field.key,
                            message: `Значение "${rowData[field.key]}" уже используется`,
                        });
                    }
                }
            }

            if (errors.filter(e => e.row === rowNum).length === 0) {
                // Нормализуем телефонные номера перед добавлением
                const phoneFieldKeys = getPhoneFieldKeys(fields as any);
                let normalizedRow = normalizeParticipantPhones(rowData, phoneFieldKeys);

                // Прескрипт (per-row)
                if (preScript) {
                    try {
                        normalizedRow = await runScript(preScript, { user: normalizedRow }, 'excel');
                    } catch (scriptErr: any) {
                        errors.push({ row: rowNum, field: '_script', message: scriptErr?.message ?? 'Ошибка прескрипта' });
                        continue;
                    }
                }

                validRows.push(normalizedRow);
            }
        }

        // Если есть ошибки - возвращаем их
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
                message: `Найдены ошибки в ${errors.length} ячейках`,
            });
        }

        if (validRows.length === 0) {
            return errorSend(res, { message: "Нет данных для импорта" });
        }

        // Создаём участников
        const [created, err] = await wrap(participantDAL.createBatch(projectId, validRows));
        if (err || !created) {
            return dbError(res, "#IMPORTEXCEL1");
        }

        // Записываем логи
        for (const participant of created) {
            await participantLogsDAL.create({
                projectId,
                participantId: participant.id,
                action: "CREATE",
                actor: "USER",
                userId,
                currentData: participant.data,
            });

            // Постскрипт (per-participant)
            if (postScript) {
                try {
                    const result = await runScript(postScript, { user: participant.data }, 'excel');
                    await wrap(participantDAL.update(participant.id, result));
                } catch (scriptErr: any) {
                    console.error(`[PROJECT POST_SCRIPT excel] projectId=${projectId} participantId=${participant.id} error:`, scriptErr?.message);
                }
            }
        }

        res.json({
            success: true,
            imported: created.length,
            message: `Импортировано ${created.length} участников`,
        });
    }

    /**
     * GET /projects/:projectId/participants/export
     * Экспорт участников в Excel
     */
    async exportToExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const includePrints = req.query.includePrints === 'true';
        const includeFirstPrint = req.query.includeFirstPrint === 'true';

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields) {
            return dbError(res, "#EXPORTEXCEL1");
        }

        // Получаем всех участников (с фильтрами и поиском)
        const [participants] = await wrap(participantDAL.getAllByProjectId(projectId, req.query as any));
        if (!participants) {
            return dbError(res, "#EXPORTEXCEL2");
        }

        // Получаем количество печатей если нужно
        let printCounts: Map<number, number> | null = null;
        if (includePrints) {
            const [counts] = await wrap(participantLogsDAL.getPrintCountsByParticipant(projectId));
            if (counts) {
                printCounts = counts;
            }
        }

        // Получаем время первой печати если нужно
        let firstPrintTimes: Map<number, Date> | null = null;
        if (includeFirstPrint) {
            const [times] = await wrap(participantLogsDAL.getFirstPrintByParticipant(projectId));
            if (times) {
                firstPrintTimes = times;
            }
        }

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet("Участники");

        // Заголовки = labels полей + служебные поля
        const columns = [
            { header: "ID", key: "_id", width: 10 },
            ...fields.map(field => ({
                header: field.label,
                key: field.key,
                width: 20,
            })),
            { header: "Дата создания", key: "_created_at", width: 20 },
            ...(includePrints ? [{ header: "Печатей", key: "_print_count", width: 10 }] : []),
            ...(includeFirstPrint ? [{ header: "Первая печать", key: "_first_print_at", width: 22 }] : []),
        ];
        worksheet.columns = columns;

        // Получаем ключи телефонных полей для форматирования
        const phoneFieldKeys = getPhoneFieldKeys(fields as any);

        // Подготавливаем строки с печатями
        let rowsData = participants.map((p: any) => {
            const row: Record<string, any> = {
                _id: p.id,
                _created_at: p.created_at,
            };
            
            // Форматируем телефоны для экспорта
            const formattedData = formatParticipantPhones(p.data, phoneFieldKeys);
            
            for (const field of fields) {
                let value = formattedData[field.key];
                
                // Преобразование массивов в строку
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                
                row[field.key] = value;
            }

            if (includePrints && printCounts) {
                row._print_count = printCounts.get(p.id) || 0;
            }

            if (includeFirstPrint && firstPrintTimes) {
                row._first_print_at = firstPrintTimes.get(p.id) ?? null;
            }
            
            return row;
        });

        // Сортируем по количеству печатей если включено
        if (includePrints) {
            rowsData.sort((a: any, b: any) => (b._print_count || 0) - (a._print_count || 0));
        }

        // Добавляем строки
        for (const row of rowsData) {
            worksheet.addRow(row);
        }

        // Форматируем колонку с датой первой печати как дата-время
        if (includeFirstPrint) {
            const col = worksheet.getColumn('_first_print_at');
            col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1 && cell.value instanceof Date) {
                    cell.numFmt = 'dd.mm.yyyy hh:mm:ss';
                }
            });
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
            `attachment; filename=participants_project_${projectId}_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * DELETE /projects/:projectId/participants
     * Очистка всех участников и логов проекта
     */
    async clearAll(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        // Удаляем сначала логи
        const [logsDeleted, logsErr] = await wrap(participantLogsDAL.deleteAllByProject(projectId));
        if (logsErr) {
            return dbError(res, "#CLEARALL1");
        }

        // Удаляем участников
        const [participantsDeleted, participantsErr] = await wrap(participantDAL.deleteAllByProject(projectId));
        if (participantsErr) {
            return dbError(res, "#CLEARALL2");
        }

        res.json({
            success: true,
            deleted: {
                participants: participantsDeleted,
                logs: logsDeleted,
            },
            message: `Удалено ${participantsDeleted} участников и ${logsDeleted} записей лога`,
        });
    }
}

// ===== Вспомогательные функции =====

/**
 * Получить подсказку по типу поля
 */
function getFieldTypeHint(config: ProjectFieldConfig): string {
    switch (config.type) {
        case 'text':
            return config.maxLength ? `текст, макс ${config.maxLength} симв.` : 'текст';
        case 'bool':
            return 'true/false';
        case 'list':
            if (config.listSettings) {
                const values = config.listSettings.items.map(i => i.value).join(', ');
                const multiple = config.listSettings.multiple ? ', множ. выбор' : '';
                return `список: ${values}${multiple}`;
            }
            return 'список';
        case 'img':
            return 'URL изображения';
        case 'code':
            return 'код';
        default:
            return 'текст';
    }
}

/**
 * Валидация данных строки
 */
function validateRowData(
    data: Record<string, any>,
    fieldMap: Map<string, { key: string; label: string; config: ProjectFieldConfig }>,
    rowNum: number
): { row: number; field: string; message: string }[] {
    const errors: { row: number; field: string; message: string }[] = [];

    for (const [key, value] of Object.entries(data)) {
        const field = fieldMap.get(key);
        if (!field) continue; // Игнорируем неизвестные поля

        const { config, label } = field;

        switch (config.type) {
            case 'text':
                if (typeof value !== 'string' && typeof value !== 'number') {
                    errors.push({ row: rowNum, field: key, message: `${label}: ожидается текст` });
                } else if (config.maxLength && String(value).length > config.maxLength) {
                    errors.push({ row: rowNum, field: key, message: `${label}: макс ${config.maxLength} символов` });
                }
                break;

            case 'bool':
                const boolValue = String(value).toLowerCase();
                if (!['true', 'false', '1', '0', 'да', 'нет'].includes(boolValue)) {
                    errors.push({ row: rowNum, field: key, message: `${label}: ожидается true/false` });
                }
                // Преобразуем в boolean
                data[key] = ['true', '1', 'да'].includes(boolValue);
                break;

            case 'list':
                if (config.listSettings) {
                    const allowedValues = config.listSettings.items.map(i => i.value);
                    const hasWildcardValue = allowedValues.includes('_');
                    
                    if (config.listSettings.multiple) {
                        // Для множественного выбора - разбиваем строку по запятой
                        const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
                        if (!hasWildcardValue) {
                            const invalid = values.filter(v => !allowedValues.includes(v));
                            if (invalid.length > 0) {
                                errors.push({ row: rowNum, field: key, message: `${label}: недопустимые значения: ${invalid.join(', ')}` });
                            } else {
                                data[key] = values;
                            }
                        } else {
                            data[key] = values;
                        }
                    } else {
                        if (!hasWildcardValue && !allowedValues.includes(String(value))) {
                            errors.push({ row: rowNum, field: key, message: `${label}: допустимо: ${allowedValues.join(', ')}` });
                        }
                    }
                }
                break;

            case 'img':
            case 'code':
                // Просто преобразуем в строку
                data[key] = String(value);
                break;
        }
    }

    return errors;
}

/**
 * Сервис для поиска участника по коду
 */
export class ParticipantCodeService {
    /**
     * GET /projects/:projectId/code/:code
     * Поиск участника по коду в любом из полей типа code
     */
    async findByCode(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const code = req.params.code;

        // Получаем схему проекта
        const [fields, fieldsErr] = await wrap(fieldDAL.getByProjectId(projectId));
        if (fieldsErr || !fields) {
            return dbError(res, "#FINDBYCODE1");
        }

        // Находим все поля с типом code
        const codeFields = fields.filter(f => f.config?.type === 'code');

        if (codeFields.length === 0) {
            return errorSend(
                res,
                { message: "В схеме проекта нет полей типа 'code'" },
                { code: 400 }
            );
        }

        // Получаем ключи полей
        const codeFieldKeys = codeFields.map(f => f.key);

        // Ищем участника
        const [participant, searchErr] = await wrap(
            participantDAL.findByCode(projectId, code, codeFieldKeys)
        );

        if (searchErr) {
            return dbError(res, "#FINDBYCODE2");
        }

        if (!participant) {
            return errorSend(
                res,
                { message: "Участник с указанным кодом не найден" },
                { code: 404 }
            );
        }

        res.json(ParticipantHelper.toJSON(participant));
    }
}
