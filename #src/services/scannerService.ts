import { Request, Response } from "express";
import { scannersDAL, scannerLogsDAL } from "../dal/scannersDAL";
import { ScannerHelper, ScannerLogHelper, ScannerLogUploadItem } from "../models/scanners";
import { ProjectHelper, Project } from "../models/projects";
import { Zone } from "../models/zones";
import { zonesDAL } from "../dal/zonesDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ProjectFieldHelper } from "../models/projectFields";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { ParticipantHelper } from "../models/participants";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201 } from "../utils/responses";

const projectFieldsDAL = new ProjectFieldsDAL();
const participantsDAL = new ParticipantsDAL();

/**
 * Сервис для работы со сканерами
 */
export class ScannerService {
    /**
     * POST /scanner/join/:projectSlug/zone/:zoneId
     * Подключение сканера к проекту и зоне
     */
    async join(
        req: Request & { project?: Project; zone?: Zone },
        res: Response
    ) {
        const project = req.project!;
        const zone = req.zone!;
        const { scanner: scannerId } = req.body;

        // Создаём или обновляем сканер
        const [scannerResult, err] = await wrap(
            scannersDAL.upsert({
                scannerId,
                projectId: project.id,
                zoneId: zone.id,
            })
        );

        if (err || !scannerResult) {
            return dbError(res, "#SCANNER_JOIN1");
        }

        response201(res, {
            message: "Сканер успешно подключен",
            scanner: ScannerHelper.toJSON(scannerResult),
        });
    }

    /**
     * GET /scanner/project
     * Получение сведений о проекте и схеме
     */
    async getProject(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;

        // Получаем схему полей
        const [fields, err] = await wrap(
            projectFieldsDAL.getByProjectId(project.id)
        );

        if (err) {
            return dbError(res, "#SCANNER_PROJECT1");
        }

        // Получаем информацию о зоне сканера (с правилами если не free)
        let zone: { id: number; name: string; free: boolean; rules?: string[] } | null = null;
        if (scanner) {
            const [zoneData] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zoneData) {
                zone = {
                    id: zoneData.id,
                    name: zoneData.name,
                    free: zoneData.free,
                };
                // Добавляем правила для зон с ограниченным доступом
                if (!zoneData.free && zoneData.rules) {
                    zone.rules = zoneData.rules.map((r: { list_item: string }) => r.list_item);
                }
            }
        }

        res.json({
            project: ProjectHelper.toJSON(project),
            scheme: fields?.map(ProjectFieldHelper.toJSON) || [],
            zone,
            scanner: scanner ? ScannerHelper.toJSON(scanner) : null,
        });
    }

    /**
     * GET /scanner/participants/code/:code
     * Получение участника по коду
     */
    async getParticipantByCode(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { code } = req.params;

        // Получаем поля типа code из схемы
        const [fields, fieldsErr] = await wrap(
            projectFieldsDAL.getByProjectId(project.id)
        );

        if (fieldsErr) {
            return dbError(res, "#SCANNER_CODE0");
        }

        const codeFieldKeys = (fields || [])
            .filter((f) => f.config.type === "code")
            .map((f) => f.key);

        if (codeFieldKeys.length === 0) {
            return res.status(400).json({
                error: "В проекте нет полей типа code",
                code: "NO_CODE_FIELDS",
            });
        }

        // Ищем участника по коду
        const [participant, err] = await wrap(
            participantsDAL.findByCode(project.id, code, codeFieldKeys)
        );

        if (err) {
            return dbError(res, "#SCANNER_CODE1");
        }

        if (!participant) {
            return res.status(404).json({
                error: "Участник не найден",
                code: "PARTICIPANT_NOT_FOUND",
            });
        }

        // Проверяем доступ к зоне (если зона не free)
        let zoneAccess: { allowed: boolean; reason: string; value?: any } | null = null;
        if (scanner) {
            const [zone] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zone) {
                if (zone.free) {
                    zoneAccess = { allowed: true, reason: "free_zone" };
                } else {
                    // Проверяем правила доступа
                    const rulesField = project.rules_field;
                    if (rulesField && participant.data[rulesField]) {
                        const participantValue = participant.data[rulesField];
                        const hasAccess = zone.rules.some(
                            (rule: { list_item: string }) => rule.list_item === participantValue
                        );
                        zoneAccess = {
                            allowed: hasAccess,
                            reason: hasAccess ? "rule_match" : "no_rule_match",
                            value: participantValue,
                        };
                    } else {
                        zoneAccess = { allowed: false, reason: "no_rules_field" };
                    }
                }
            }
        }

        res.json({
            participant: ParticipantHelper.toJSON(participant),
            zoneAccess,
        });
    }

    /**
     * POST /scanner/logs/upload
     * Выгрузка логов сканера
     */
    async uploadLogs(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { logs } = req.body as { logs: ScannerLogUploadItem[] };

        // Преобразуем логи для вставки
        const logsToInsert = logs.map((log) => ({
            projectId: project.id,
            zoneId: log.zone,
            scannerId: scanner?.id,
            userCode: log.userCode,
            timestamp: log.timestamp,
            direction: log.direction,
            hash: log.hash,
        }));

        // Массовая вставка
        const [result, err] = await wrap(scannerLogsDAL.bulkCreate(logsToInsert));

        if (err) {
            return dbError(res, "#SCANNER_UPLOAD1");
        }

        res.json({
            message: "Логи обработаны",
            inserted: result?.inserted || 0,
            skipped: result?.skipped || 0,
            errors: result?.errors || 0,
            total: logs.length,
        });
    }

    /**
     * POST /scanner/checkout
     * Отметить устройство как выданное
     */
    async checkout(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const scanner = req.scannerAuth.scanner;
        if (!scanner) {
            return res.status(404).json({ error: "Сканер не найден" });
        }

        const [result, err] = await wrap(scannersDAL.checkout(scanner.scanner_id));

        if (err || !result) {
            return dbError(res, "#SCANNER_CHECKOUT1");
        }

        res.json({
            message: "Устройство выдано",
            scanner: ScannerHelper.toJSON(result),
        });
    }

    /**
     * POST /scanner/checkin
     * Отметить устройство как сданное
     */
    async checkin(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const scanner = req.scannerAuth.scanner;
        if (!scanner) {
            return res.status(404).json({ error: "Сканер не найден" });
        }

        const [result, err] = await wrap(scannersDAL.checkin(scanner.scanner_id));

        if (err || !result) {
            return dbError(res, "#SCANNER_CHECKIN1");
        }

        res.json({
            message: "Устройство сдано",
            scanner: ScannerHelper.toJSON(result),
        });
    }

    /**
     * POST /scanner/mark/:participantId
     * Отметить участника (установить isMark-поле в true)
     * Сканер отправляет ID участника, сервер находит поле с isMark и обновляет его
     */
    async markParticipant(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const { participantId } = req.params;

        // 1. Находим поле с isMark: true в схеме проекта
        const [fields, fieldsErr] = await wrap(
            projectFieldsDAL.getByProjectId(project.id)
        );

        if (fieldsErr) {
            return dbError(res, "#SCANNER_MARK1");
        }

        const markField = (fields || []).find(
            (f) => f.config.type === "bool" && f.config.isMark === true
        );

        if (!markField) {
            return res.status(400).json({
                error: "В проекте нет поля с флагом отметки",
                code: "NO_MARK_FIELD",
            });
        }

        // 2. Получаем участника
        const [participant, participantErr] = await wrap(
            participantsDAL.getById(Number(participantId))
        );

        if (participantErr) {
            return dbError(res, "#SCANNER_MARK2");
        }

        if (!participant || participant.project_id !== project.id) {
            return res.status(404).json({
                error: "Участник не найден",
                code: "PARTICIPANT_NOT_FOUND",
            });
        }

        // 3. Проверяем, не отмечен ли уже
        const currentValue = participant.data?.[markField.key];
        if (currentValue === true) {
            return res.status(409).json({
                error: "Участник уже отмечен",
                code: "ALREADY_MARKED",
                field: markField.label,
            });
        }

        // 4. Обновляем поле
        const newData = {
            ...participant.data,
            [markField.key]: true,
        };

        const [updated, updateErr] = await wrap(
            participantsDAL.update(participant.id, newData)
        );

        if (updateErr || !updated) {
            return dbError(res, "#SCANNER_MARK3");
        }

        res.json({
            message: "Участник отмечен",
            participant: ParticipantHelper.toJSON(updated),
            markField: markField.label,
        });
    }
}

export const scannerService = new ScannerService();
