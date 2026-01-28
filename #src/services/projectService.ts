import { Request, Response } from "express";
import { ReqWithBody, ReqWithParams, ReqWithQuery } from "../baseTypes";
import { ProjectsDAL as pDAL } from "../dal/projectsDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
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

        if (!projects) return dbError(res, "#GETProj1");

        const list = Array.isArray(projects) ? projects.map(ProjectHelper.toJSON) : [];

        res.json(
            paginationResponse({
                list,
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
        // Выполняем жесткое удаление (hard delete)
        const [result, err] = await wrap(ProjectDAL.hardDelete([Number(id)]), !!1);

        console.log(err, err === null);
        
        if (err !== null) {
            return dbError(res, "#DelProj1");
        }

        // result — количество удалённых строк
        if (!result || result === 0) {
            return res.status(404).json({ error: 'Проект не найден' });
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
