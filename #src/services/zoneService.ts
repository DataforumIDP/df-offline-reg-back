import { Request, Response } from "express";
import { zonesDAL } from "../dal/zonesDAL";
import { ZoneHelper, ZoneRuleHelper } from "../models/zones";
import { ScannerConfig, ScannerHelper } from "../models/scanners";
import { projectAuthDAL, scannersDAL } from "../dal/scannersDAL";
import { ProjectsDAL } from "../dal/projectsDAL";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import dotenv from 'dotenv'
dotenv.config()

const { API_HOST } = process.env

const projectsDAL = new ProjectsDAL();

class ZoneService {
    /**
     * GET /zones
     * Получение списка зон (с фильтрацией по projectId)
     */
    async getAll(req: Request, res: Response) {
        const projectId = Number(req.query.projectId);

        if (!projectId || isNaN(projectId)) {
            return res.status(400).json({ error: "projectId обязателен" });
        }

        const [zones, err] = await wrap(zonesDAL.getByProjectIdWithRules(projectId));

        if (err) {
            return dbError(res, "#GETZONES1");
        }

        res.json(zones?.map(ZoneHelper.toJSON) || []);
    }

    /**
     * GET /zones/:zoneId
     * Получение одной зоны
     */
    async getOne(req: Request, res: Response) {
        const zone = req.zone!;
        
        // Получаем зону с правилами
        const [zoneWithRules, err] = await wrap(zonesDAL.getByIdWithRules(zone.id));

        if (err || !zoneWithRules) {
            return dbError(res, "#GETZONE1");
        }

        res.json(ZoneHelper.toJSON(zoneWithRules));
    }

    /**
     * POST /zones
     * Создание зоны
     */
    async create(req: Request, res: Response) {
        const { projectId, name, free } = req.body;

        const [zone, err] = await wrap(
            zonesDAL.create({ projectId, name, free })
        );

        if (err || !zone) {
            return dbError(res, "#CREATEZONE1");
        }

        response201(res, ZoneHelper.toJSON({ ...zone, rules: [] }));
    }

    /**
     * PUT /zones/:zoneId
     * Обновление зоны
     */
    async update(req: Request, res: Response) {
        const zone = req.zone!;
        const { name, free } = req.body;

        const [updated, err] = await wrap(
            zonesDAL.update(zone.id, { name, free })
        );

        if (err || !updated) {
            return dbError(res, "#UPDATEZONE1");
        }

        // Получаем обновлённую зону с правилами
        const [zoneWithRules] = await wrap(zonesDAL.getByIdWithRules(updated.id));

        res.json(ZoneHelper.toJSON(zoneWithRules || { ...updated, rules: [] }));
    }

    /**
     * DELETE /zones/:zoneId
     * Удаление зоны
     */
    async delete(req: Request, res: Response) {
        const zone = req.zone!;

        const [deleted, err] = await wrap(zonesDAL.delete(zone.id));

        if (err || !deleted) {
            return dbError(res, "#DELETEZONE1");
        }

        response204(res);
    }

    // ========== Правила доступа ==========

    /**
     * POST /zones/:zoneId/rules
     * Добавление правила доступа
     */
    async createRule(req: Request, res: Response) {
        const zone = req.zone!;
        const { listItem } = req.body;

        // Проверяем, что правило не существует
        const [existing] = await wrap(zonesDAL.getRuleByZoneAndItem(zone.id, listItem));
        if (existing) {
            return res.status(400).json({ 
                error: "Правило для этого значения уже существует" 
            });
        }

        const [rule, err] = await wrap(
            zonesDAL.createRule({ zoneId: zone.id, listItem })
        );

        if (err || !rule) {
            return dbError(res, "#CREATERULE1");
        }

        response201(res, ZoneRuleHelper.toJSON(rule));
    }

    /**
     * DELETE /zones/:zoneId/rules/:ruleId
     * Удаление правила доступа
     */
    async deleteRule(req: Request, res: Response) {
        const ruleId = Number(req.params.ruleId);

        if (!ruleId || isNaN(ruleId)) {
            return res.status(400).json({ error: "Некорректный ID правила" });
        }

        // Проверяем существование правила
        const [rule] = await wrap(zonesDAL.getRuleById(ruleId));
        if (!rule) {
            return res.status(404).json({ error: "Правило не найдено" });
        }

        // Проверяем что правило принадлежит этой зоне
        const zone = req.zone!;
        if (rule.zone_id !== zone.id) {
            return res.status(403).json({ error: "Правило не принадлежит этой зоне" });
        }

        const [deleted, err] = await wrap(zonesDAL.deleteRule(ruleId));

        if (err || !deleted) {
            return dbError(res, "#DELETERULE1");
        }

        response204(res);
    }

    /**
     * GET /zones/:zoneId/config
     * Получение конфига зоны для QR кода сканера
     */
    async getConfig(req: Request, res: Response) {
        const zone = req.zone!;

        // Получаем проект
        const [project, projectErr] = await wrap(projectsDAL.findByPk(zone.project_id));
        if (projectErr || !project) {
            return dbError(res, "#GETCONFIG1");
        }

        // Получаем или создаём ключи авторизации
        const [auth, authErr] = await wrap(projectAuthDAL.getOrCreate(project.id));
        if (authErr || !auth) {
            return dbError(res, "#GETCONFIG2");
        }

        console.log(API_HOST);
        
        // Формируем конфиг
        const config: ScannerConfig = {
            server: API_HOST || "localhost:3000",
            project: project.slug,
            zone: zone.id,
            authorize: {
                access: auth.access_key,
                secret: auth.secret_key,
            },
        };


        res.json(config);
    }

    /**
     * GET /zones/:zoneId/scanners
     * Получение списка устройств (сканеров) зоны с количеством логов
     */
    async getScanners(req: Request, res: Response) {
        const zone = req.zone!;

        const [scanners, err] = await wrap(
            scannersDAL.getByZoneIdWithLogsCount(zone.id)
        );

        if (err) {
            return dbError(res, "#GETSCANNERS1");
        }

        res.json(
            (scanners || []).map((s) => ({
                ...ScannerHelper.toJSON(s),
                logsCount: s.logsCount,
                isCurrentZone: s.zone_id === zone.id,
            }))
        );
    }
}

export const zoneService = new ZoneService();
