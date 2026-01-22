import { Request, Response } from "express";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ProjectFieldHelper } from "../models/projectFields";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";

const fieldDAL = new ProjectFieldsDAL();

export class ProjectFieldService {
    /**
     * GET /projects/:projectId/scheme
     * Получение схемы полей проекта
     */
    async getScheme(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        const [fields, err] = await wrap(fieldDAL.getByProjectId(projectId));

        if (err || fields === null) {
            return dbError(res, "#GETSCHEME1");
        }

        res.json({ fields: fields.map(ProjectFieldHelper.toJSON) });
    }

    /**
     * POST /projects/:projectId/scheme
     * Добавление нового поля в схему
     */
    async createField(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const { key, label, config } = req.body;

        const [field, err] = await wrap(fieldDAL.createField({
            project_id: projectId,
            label,
            key,
            config,
        }));

        if (err || !field) {
            return dbError(res, "#CREATEFIELD1");
        }

        response201(res, ProjectFieldHelper.toJSON(field));
    }

    /**
     * PUT /projects/:projectId/scheme/:fieldId
     * Обновление поля (только для типа list)
     */
    async updateField(req: Request, res: Response) {
        const fieldId = Number(req.params.fieldId);
        const { config } = req.body;

        const [updated, err] = await wrap(fieldDAL.updateField(fieldId, config));

        if (err || !updated) {
            return dbError(res, "#UPDATEFIELD1");
        }

        res.json(ProjectFieldHelper.toJSON(updated));
    }

    /**
     * DELETE /projects/:projectId/scheme/:fieldId
     * Удаление поля
     */
    async deleteField(req: Request, res: Response) {
        const fieldId = Number(req.params.fieldId);

        const [deleted, err] = await wrap(fieldDAL.softDelete(fieldId));

        if (err || !deleted) {
            return dbError(res, "#DELETEFIELD1");
        }

        response204(res);
    }
}
