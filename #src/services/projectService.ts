import { Request, Response } from "express";
import { ReqWithBody, ReqWithParams, ReqWithQuery } from "../baseTypes";
import { ProjectsDAL as pDAL } from "../dal/projectsDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ParticipantLogsDAL } from "../dal/participantLogsDAL";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { db } from "../config/db";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { paginationResponse } from "../utils/paginationUtils";
import { filteredObjectByKeys } from "../utils/filteredObjectByKeys";
import { ProjectHelper } from "../models/projects";
import { ProjectFieldHelper } from "../models/projectFields";
import { transliterateString } from "../utils/transliterateUtil";
import { generateRandomString } from "../utils/generateRandomString";

const ProjectDAL = new pDAL();
const fieldDAL = new ProjectFieldsDAL();
const participantLogsDAL = new ParticipantLogsDAL();
const participantsDAL = new ParticipantsDAL();

export class ProjectService {
    async create(
        req: ReqWithBody<{
            title: string;
            slug?: string;
            description?: string;
            dateStart: string;
            dateEnd: string;
        }>,
        res: Response
    ) {
        const { title, slug, description, dateStart, dateEnd } = req.body;

        // Валидация дат
        if (!ProjectHelper.validateDates(dateStart, dateEnd)) {
            return res.status(400).json({
                error: "Дата окончания не может быть раньше даты начала",
            });
        }

        // Генерация slug если не указан
        const finalSlug = slug || `id${Math.floor(1000 + Math.random() * 9000)}`;

        const data = {
            title,
            slug: finalSlug,
            description,
            dateStart: new Date(dateStart),
            dateEnd: new Date(dateEnd),
        };

        const [project] = await wrap(ProjectDAL.create(data), !!1);
        if (!project) return dbError(res, "#PROJCR1");

        response201(res, ProjectHelper.toJSON(project));
    }

    async update(
        req: ReqWithParams<{ id: string }> & ReqWithBody<{
            title?: string;
            slug?: string;
            description?: string;
            dateStart?: Date;
            dateEnd?: Date;
        }>,
        res: Response
    ) {
        const { id } = req.params;
        const data = req.body; // Данные уже отфильтрованы и обработаны в middleware

        const [result] = await wrap(ProjectDAL.updateOne(Number(id), data));

        if (result === null) return dbError(res, "#UpdProj1");

        res.json(ProjectHelper.toJSON(result));
    }

    async get(
        req: ReqWithQuery<{
            page?: string;
            search?: string;
            limit?: string;
            dateStart?: string;
            dateEnd?: string;
        }>,
        res: Response
    ) {
        const [projects, meta] = await ProjectDAL.get(req.query);

        if (!projects || !Array.isArray(projects)) return dbError(res, "#GETProj1");

        // Получаем статистику для каждого проекта
        const projectsWithStats = await Promise.all(
            projects.map(async (project) => {
                // Получаем количество участников
                const participantsCount = await db('participants')
                    .where({ project_id: project.id, is_delete: false })
                    .count('* as count')
                    .first();

                // Получаем количество печатей
                const printingsCount = await db('participant_logs')
                    .where({ project_id: project.id, action: 'PRINT' })
                    .count('* as count')
                    .first();

                return {
                    ...ProjectHelper.toJSON(project),
                    stats: {
                        participants: Number((participantsCount as any)?.count || 0),
                        printings: Number((printingsCount as any)?.count || 0),
                    }
                };
            })
        );

        res.json(
            paginationResponse({
                list: projectsWithStats,
                all: Array.isArray(meta) ? 0 : meta.total,
                limit: req.query.limit,
                page: req.query.page,
            })
        );
    }

    async getOne(
        req: ReqWithParams<{ slugOrId: string }>,
        res: Response
    ) {
        const { slugOrId } = req.params;

        const [project] = await wrap(ProjectDAL.getBySlugOrId(slugOrId));

        if (!project) {
            return res.status(404).json({
                error: "Проект не найден",
            });
        }

        // Получаем схему полей проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(project.id));
        const scheme = fields ? fields.map(ProjectFieldHelper.toJSON) : [];

        res.json({
            ...ProjectHelper.toJSON(project),
            scheme,
        });
    }

    async delete(
        req: ReqWithParams<{ id: string }>,
        res: Response
    ) {
        const { id } = req.params;
        const projectId = Number(id);

        // Проверяем, что проект существует
        const project = await db('projects').where({ id: projectId }).first();
        if (!project) {
            return res.status(404).json({ error: 'Проект не найден' });
        }

        // Явное каскадное удаление всех данных проекта
        // (FK-constraints также имеют ON DELETE CASCADE, но удаляем явно для прозрачности)
        try {
            await db.transaction(async (trx) => {
                // 1. Журнал устройств
                await trx('device_journal').where({ project_id: projectId }).del();

                // 2. Логи сканеров
                await trx('scanner_logs').where({ project_id: projectId }).del();

                // 3. Сканеры
                await trx('scanners').where({ project_id: projectId }).del();

                // 4. Ключи авторизации сканеров
                await trx('project_auth').where({ project_id: projectId }).del();

                // 5. Логи вебхуков (через webhook_id)
                const webhookIds = await trx('webhooks')
                    .where({ project_id: projectId })
                    .pluck('id');
                if (webhookIds.length > 0) {
                    await trx('webhook_logs').whereIn('webhook_id', webhookIds).del();
                }

                // 6. Вебхуки
                await trx('webhooks').where({ project_id: projectId }).del();

                // 7. Правила зон (через zone_id)
                const zoneIds = await trx('zones')
                    .where({ project_id: projectId })
                    .pluck('id');
                if (zoneIds.length > 0) {
                    await trx('zone_rules').whereIn('zone_id', zoneIds).del();
                }

                // 8. Зоны
                await trx('zones').where({ project_id: projectId }).del();

                // 9. Логи участников (журнал печати, сканирования, изменений)
                await trx('participant_logs').where({ project_id: projectId }).del();

                // 10. Участники
                await trx('participants').where({ project_id: projectId }).del();

                // 11. Привязка шаблона печати
                await trx('project_print_templates').where({ project_id: projectId }).del();

                // 12. Схема проекта (поля)
                await trx('project_fields').where({ project_id: projectId }).del();

                // 13. Сам проект
                await trx('projects').where({ id: projectId }).del();
            });
        } catch (err) {
            console.error('[delete project]', err);
            return dbError(res, '#DelProj1');
        }

        response204(res);
    }

    async getUsers(
        req: ReqWithParams<{ id: string }> & ReqWithQuery<{
            page?: string;
            search?: string;
            limit?: string;
        }>,
        res: Response
    ) {
        const { id } = req.params;

        // Проверяем существование проекта
        const [project] = await wrap(ProjectDAL.findByPk(Number(id)));
        if (!project) {
            return res.status(404).json({
                error: "Проект не найден",
            });
        }

        // Импортируем AccountsDAL для получения пользователей
        const { AccountsDAL } = await import("../dal/accountsDAL");
        const accountDAL = new AccountsDAL();

        const [accounts, meta] = await accountDAL.getByProjectId(Number(id), req.query);

        if (!accounts) return dbError(res, "#GETProjUsers1");

        res.json(
            paginationResponse({
                list: accounts,
                all: Array.isArray(meta) ? 0 : meta.total,
                limit: req.query.limit,
                page: req.query.page,
            })
        );
    }
}
