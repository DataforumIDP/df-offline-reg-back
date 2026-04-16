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
 * РЎРµСЂРІРёСЃ РґР»СЏ СЂР°Р±РѕС‚С‹ СЃРѕ СЃРєР°РЅРµСЂР°РјРё
 */
export class ScannerService {
    /**
     * POST /scanner/join/:projectSlug/zone/:zoneId
     * РџРѕРґРєР»СЋС‡РµРЅРёРµ СЃРєР°РЅРµСЂР° Рє РїСЂРѕРµРєС‚Сѓ Рё Р·РѕРЅРµ
     */
    async join(
        req: Request & { project?: Project; zone?: Zone },
        res: Response
    ) {
        const project = req.project!;
        const zone = req.zone!;
        const { scanner: scannerId } = req.body;

        // РЎРѕР·РґР°С‘Рј РёР»Рё РѕР±РЅРѕРІР»СЏРµРј СЃРєР°РЅРµСЂ
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
            message: "РЎРєР°РЅРµСЂ СѓСЃРїРµС€РЅРѕ РїРѕРґРєР»СЋС‡РµРЅ",
            scanner: ScannerHelper.toJSON(scannerResult),
        });
    }

    /**
     * GET /scanner/project
     * РџРѕР»СѓС‡РµРЅРёРµ СЃРІРµРґРµРЅРёР№ Рѕ РїСЂРѕРµРєС‚Рµ Рё СЃС…РµРјРµ
     */
    async getProject(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;

        // РџРѕР»СѓС‡Р°РµРј СЃС…РµРјСѓ РїРѕР»РµР№
        const [fields, err] = await wrap(
            projectFieldsDAL.getByProjectId(project.id)
        );

        if (err) {
            return dbError(res, "#SCANNER_PROJECT1");
        }

        // РџРѕР»СѓС‡Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ Р·РѕРЅРµ СЃРєР°РЅРµСЂР° (СЃ РїСЂР°РІРёР»Р°РјРё РµСЃР»Рё РЅРµ free)
        let zone: { id: number; name: string; free: boolean; rules?: string[] } | null = null;
        if (scanner) {
            const [zoneData] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zoneData) {
                zone = {
                    id: zoneData.id,
                    name: zoneData.name,
                    free: zoneData.free,
                };
                // Р”РѕР±Р°РІР»СЏРµРј РїСЂР°РІРёР»Р° РґР»СЏ Р·РѕРЅ СЃ РѕРіСЂР°РЅРёС‡РµРЅРЅС‹Рј РґРѕСЃС‚СѓРїРѕРј
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
     * РџРѕР»СѓС‡РµРЅРёРµ СѓС‡Р°СЃС‚РЅРёРєР° РїРѕ РєРѕРґСѓ
     */
    async getParticipantByCode(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { code } = req.params;

        // РџРѕР»СѓС‡Р°РµРј РїРѕР»СЏ С‚РёРїР° code РёР· СЃС…РµРјС‹
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
                error: "Р’ РїСЂРѕРµРєС‚Рµ РЅРµС‚ РїРѕР»РµР№ С‚РёРїР° code",
                code: "NO_CODE_FIELDS",
            });
        }

        // РС‰РµРј СѓС‡Р°СЃС‚РЅРёРєР° РїРѕ РєРѕРґСѓ
        const [participant, err] = await wrap(
            participantsDAL.findByCode(project.id, code, codeFieldKeys)
        );

        if (err) {
            return dbError(res, "#SCANNER_CODE1");
        }

        if (!participant) {
            return res.status(404).json({
                error: "РЈС‡Р°СЃС‚РЅРёРє РЅРµ РЅР°Р№РґРµРЅ",
                code: "PARTICIPANT_NOT_FOUND",
            });
        }

        // РџСЂРѕРІРµСЂСЏРµРј РґРѕСЃС‚СѓРї Рє Р·РѕРЅРµ (РµСЃР»Рё Р·РѕРЅР° РЅРµ free)
        let zoneAccess: { allowed: boolean; reason: string; value?: any } | null = null;
        if (scanner) {
            const [zone] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zone) {
                if (zone.free) {
                    zoneAccess = { allowed: true, reason: "free_zone" };
                } else {
                    // РџСЂРѕРІРµСЂСЏРµРј РїСЂР°РІРёР»Р° РґРѕСЃС‚СѓРїР°
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
     * Р’С‹РіСЂСѓР·РєР° Р»РѕРіРѕРІ СЃРєР°РЅРµСЂР°
     */
    async uploadLogs(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { logs } = req.body as { logs: ScannerLogUploadItem[] };

        // РџСЂРµРѕР±СЂР°Р·СѓРµРј Р»РѕРіРё РґР»СЏ РІСЃС‚Р°РІРєРё
        const logsToInsert = logs.map((log) => ({
            projectId: project.id,
            zoneId: log.zone,
            scannerId: scanner?.id,
            userCode: log.userCode,
            timestamp: log.timestamp,
            direction: log.direction,
            hash: log.hash,
        }));

        // РњР°СЃСЃРѕРІР°СЏ РІСЃС‚Р°РІРєР°
        const [result, err] = await wrap(scannerLogsDAL.bulkCreate(logsToInsert));

        if (err) {
            return dbError(res, "#SCANNER_UPLOAD1");
        }

        res.json({
            message: "Р›РѕРіРё РѕР±СЂР°Р±РѕС‚Р°РЅС‹",
            inserted: result?.inserted || 0,
            skipped: result?.skipped || 0,
            errors: result?.errors || 0,
            total: logs.length,
        });
    }

    /**
     * POST /scanner/checkout
     * РћС‚РјРµС‚РёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ РєР°Рє РІС‹РґР°РЅРЅРѕРµ
     */
    async checkout(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const scanner = req.scannerAuth.scanner;
        if (!scanner) {
            return res.status(404).json({ error: "РЎРєР°РЅРµСЂ РЅРµ РЅР°Р№РґРµРЅ" });
        }

        const [result, err] = await wrap(scannersDAL.checkout(scanner.scanner_id));

        if (err || !result) {
            return dbError(res, "#SCANNER_CHECKOUT1");
        }

        res.json({
            message: "РЈСЃС‚СЂРѕР№СЃС‚РІРѕ РІС‹РґР°РЅРѕ",
            scanner: ScannerHelper.toJSON(result),
        });
    }

    /**
     * POST /scanner/checkin
     * РћС‚РјРµС‚РёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ РєР°Рє СЃРґР°РЅРЅРѕРµ
     */
    async checkin(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const scanner = req.scannerAuth.scanner;
        if (!scanner) {
            return res.status(404).json({ error: "РЎРєР°РЅРµСЂ РЅРµ РЅР°Р№РґРµРЅ" });
        }

        const [result, err] = await wrap(scannersDAL.checkin(scanner.scanner_id));

        if (err || !result) {
            return dbError(res, "#SCANNER_CHECKIN1");
        }

        res.json({
            message: "РЈСЃС‚СЂРѕР№СЃС‚РІРѕ СЃРґР°РЅРѕ",
            scanner: ScannerHelper.toJSON(result),
        });
    }

    /**
     * POST /scanner/mark/:participantId
     * РћС‚РјРµС‚РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєР° (СѓСЃС‚Р°РЅРѕРІРёС‚СЊ isMark-РїРѕР»Рµ РІ true)
     * РЎРєР°РЅРµСЂ РѕС‚РїСЂР°РІР»СЏРµС‚ ID СѓС‡Р°СЃС‚РЅРёРєР°, СЃРµСЂРІРµСЂ РЅР°С…РѕРґРёС‚ РїРѕР»Рµ СЃ isMark Рё РѕР±РЅРѕРІР»СЏРµС‚ РµРіРѕ
     */
    async markParticipant(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "РќРµ Р°РІС‚РѕСЂРёР·РѕРІР°РЅ" });
        }

        const project = req.scannerAuth.project;
        const { participantId } = req.params;

        // 1. РќР°С…РѕРґРёРј РїРѕР»Рµ СЃ isMark: true РІ СЃС…РµРјРµ РїСЂРѕРµРєС‚Р°
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
                error: "Р’ РїСЂРѕРµРєС‚Рµ РЅРµС‚ РїРѕР»СЏ СЃ С„Р»Р°РіРѕРј РѕС‚РјРµС‚РєРё",
                code: "NO_MARK_FIELD",
            });
        }

        // 2. РџРѕР»СѓС‡Р°РµРј СѓС‡Р°СЃС‚РЅРёРєР°
        const [participant, participantErr] = await wrap(
            participantsDAL.getById(Number(participantId))
        );

        if (participantErr) {
            return dbError(res, "#SCANNER_MARK2");
        }

        if (!participant || participant.project_id !== project.id) {
            return res.status(404).json({
                error: "РЈС‡Р°СЃС‚РЅРёРє РЅРµ РЅР°Р№РґРµРЅ",
                code: "PARTICIPANT_NOT_FOUND",
            });
        }

        // 3. РџСЂРѕРІРµСЂСЏРµРј, РЅРµ РѕС‚РјРµС‡РµРЅ Р»Рё СѓР¶Рµ
        const currentValue = participant.data?.[markField.key];
        if (currentValue === true) {
            return res.status(409).json({
                error: "РЈС‡Р°СЃС‚РЅРёРє СѓР¶Рµ РѕС‚РјРµС‡РµРЅ",
                code: "ALREADY_MARKED",
                field: markField.label,
            });
        }

        // 4. РћР±РЅРѕРІР»СЏРµРј РїРѕР»Рµ
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
            message: "РЈС‡Р°СЃС‚РЅРёРє РѕС‚РјРµС‡РµРЅ",
            participant: ParticipantHelper.toJSON(updated),
            markField: markField.label,
        });
    }
    // ===== Журнал устройств =====

    /**
     * POST /scanner/journal/checkout
     * Выдать устройство участнику
     */
    async journalCheckout(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { userCode, userName, participantId } = req.body;

        if (!userCode) {
            return res.status(400).json({
                error: "Код участника обязателен",
                code: "USER_CODE_REQUIRED",
            });
        }

        // Проверяем, включён ли журнал
        if (!project.journal_enabled) {
            return res.status(400).json({
                error: "Журнал не включён для проекта",
                code: "JOURNAL_DISABLED",
            });
        }

        // Проверяем, нет ли уже активной выдачи для этого участника
        const { deviceJournalDAL } = await import("../dal/deviceJournalDAL");
        const [existingRecord, existErr] = await wrap(
            deviceJournalDAL.findActiveByUserCode(project.id, userCode)
        );

        if (existErr) {
            return dbError(res, "#JOURNAL_CHECKOUT1");
        }

        if (existingRecord) {
            return res.status(409).json({
                error: "У участника уже есть активная выдача",
                code: "ALREADY_CHECKED_OUT",
                record: {
                    checkoutAt: existingRecord.checkout_at,
                    zoneName: existingRecord.zone_name,
                },
            });
        }

        // Получаем информацию о зоне
        let zoneName: string | null = null;
        if (scanner) {
            const [zone] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zone) {
                zoneName = zone.name;
            }
        }

        // Создаём запись о выдаче
        const [record, createErr] = await wrap(
            deviceJournalDAL.checkout({
                projectId: project.id,
                zoneId: scanner?.zone_id ?? null,
                scannerId: scanner?.id ?? null,
                scannerName: scanner?.name ?? scanner?.scanner_id ?? null,
                zoneName,
                userCode,
                userName: userName || null,
                participantId: participantId || null,
            })
        );

        if (createErr || !record) {
            return dbError(res, "#JOURNAL_CHECKOUT2");
        }

        const { DeviceJournalHelper } = await import("../models/deviceJournal");
        res.json({
            message: "Устройство выдано",
            record: DeviceJournalHelper.toJSON(record),
        });
    }

    /**
     * POST /scanner/journal/checkin
     * Сдать устройство
     */
    async journalCheckin(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const { userCode } = req.body;

        if (!userCode) {
            return res.status(400).json({
                error: "Код участника обязателен",
                code: "USER_CODE_REQUIRED",
            });
        }

        // Проверяем, включён ли журнал
        if (!project.journal_enabled) {
            return res.status(400).json({
                error: "Журнал не включён для проекта",
                code: "JOURNAL_DISABLED",
            });
        }

        const { deviceJournalDAL } = await import("../dal/deviceJournalDAL");
        const [record, err] = await wrap(
            deviceJournalDAL.checkin(project.id, userCode, false)
        );

        if (err) {
            return dbError(res, "#JOURNAL_CHECKIN1");
        }

        if (!record) {
            return res.status(404).json({
                error: "Активная выдача не найдена",
                code: "NOT_FOUND",
            });
        }

        const { DeviceJournalHelper } = await import("../models/deviceJournal");
        res.json({
            message: "Устройство сдано",
            record: DeviceJournalHelper.toJSON(record),
        });
    }

    /**
     * GET /scanner/journal/status/:userCode
     * Проверить статус участника
     */
    async journalStatus(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const { userCode } = req.params;

        // Проверяем, включён ли журнал
        if (!project.journal_enabled) {
            return res.status(400).json({
                error: "Журнал не включён для проекта",
                code: "JOURNAL_DISABLED",
            });
        }

        const { deviceJournalDAL } = await import("../dal/deviceJournalDAL");
        const [record, err] = await wrap(
            deviceJournalDAL.findActiveByUserCode(project.id, userCode)
        );

        if (err) {
            return dbError(res, "#JOURNAL_STATUS1");
        }

        if (!record) {
            return res.json({
                hasActiveCheckout: false,
                record: null,
            });
        }

        const { DeviceJournalHelper } = await import("../models/deviceJournal");
        res.json({
            hasActiveCheckout: true,
            record: DeviceJournalHelper.toJSON(record),
        });
    }

    /**
     * POST /scanner/journal/toggle
     * Переключить состояние: checkout или checkin в зависимости от активной записи
     */
    async journalToggle(req: Request, res: Response) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const project = req.scannerAuth.project;
        const scanner = req.scannerAuth.scanner;
        const { userCode, userName, participantId } = req.body;

        if (!userCode) {
            return res.status(400).json({
                error: "Код участника обязателен",
                code: "USER_CODE_REQUIRED",
            });
        }

        // Проверяем, включён ли журнал
        if (!project.journal_enabled) {
            return res.status(400).json({
                error: "Журнал не включён для проекта",
                code: "JOURNAL_DISABLED",
            });
        }

        const { deviceJournalDAL } = await import("../dal/deviceJournalDAL");
        const { DeviceJournalHelper } = await import("../models/deviceJournal");

        // Проверяем, есть ли активная запись
        const [existingRecord, existErr] = await wrap(
            deviceJournalDAL.findActiveByUserCode(project.id, userCode)
        );

        if (existErr) {
            return dbError(res, "#JOURNAL_TOGGLE1");
        }

        if (existingRecord) {
            // Есть активная запись - делаем checkin
            const [record, checkinErr] = await wrap(
                deviceJournalDAL.checkin(project.id, userCode, false)
            );

            if (checkinErr || !record) {
                return dbError(res, "#JOURNAL_TOGGLE2");
            }

            return res.json({
                action: "checkin",
                message: "Устройство сдано",
                record: DeviceJournalHelper.toJSON(record),
            });
        }

        // Нет активной записи - делаем checkout
        let zoneName: string | null = null;
        if (scanner) {
            const [zone] = await wrap(zonesDAL.getByIdWithRules(scanner.zone_id));
            if (zone) {
                zoneName = zone.name;
            }
        }

        const [record, createErr] = await wrap(
            deviceJournalDAL.checkout({
                projectId: project.id,
                zoneId: scanner?.zone_id ?? null,
                scannerId: scanner?.id ?? null,
                scannerName: scanner?.name ?? scanner?.scanner_id ?? null,
                zoneName,
                userCode,
                userName: userName || null,
                participantId: participantId || null,
            })
        );

        if (createErr || !record) {
            return dbError(res, "#JOURNAL_TOGGLE3");
        }

        res.json({
            action: "checkout",
            message: "Устройство выдано",
            record: DeviceJournalHelper.toJSON(record),
        });
    }

    /**
     * GET /scanner/journal
     * Получить все записи журнала для проекта текущего сканера
     */
    async journalGetRecords(
        req: Request & { project?: Project; scanner?: any },
        res: Response
    ) {
        if (!req.scannerAuth) {
            return res.status(401).json({ error: "Не авторизован" });
        }
        const project = req.scannerAuth.project;

        const { deviceJournalDAL } = await import("../dal/deviceJournalDAL");
        const { DeviceJournalHelper } = await import("../models/deviceJournal");

        const [result, err] = await wrap(
            deviceJournalDAL.getAll(project.id, {})
        );

        if (err || !result) {
            return dbError(res, "#JOURNAL_LIST1");
        }

        res.json({
            records: result.records.map(DeviceJournalHelper.toJSON),
            totalRecords: result.totalRecords,
        });
    }
}

export const scannerService = new ScannerService();
