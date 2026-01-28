import { Request, Response } from "express";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ProjectFieldHelper } from "../models/projectFields";
import { dbError } from "../utils/errors";
import { errorSend } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { db } from "../config/db";

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
        const projectId = Number(req.params.projectId);
        const fieldId = Number(req.params.fieldId);
        const { label, key, type, config } = req.body;

        // Получаем текущее поле
        const [existing, getErr] = await wrap(fieldDAL.getById(fieldId));
        if (getErr || !existing) {
            return dbError(res, "#UPDATEFIELD1");
        }

        // Проверяем уникальность ключа и названия (исключая текущее поле)
        const [isKeyUnique, keyErr] = await wrap(fieldDAL.isKeyUnique(projectId, key, fieldId));
        if (keyErr) return dbError(res, "#UPDATEFIELD2");
        if (!isKeyUnique) {
            return errorSend(res, { key: `Поле с ключом "${key}" уже существует в этом проекте` }, { code: 400 });
        }

        const [isLabelUnique, labelErr] = await wrap(fieldDAL.isLabelUnique(projectId, label, fieldId));
        if (labelErr) return dbError(res, "#UPDATEFIELD3");
        if (!isLabelUnique) {
            return errorSend(res, { label: `Поле с названием "${label}" уже существует в этом проекте` }, { code: 400 });
        }

        // Если ключ не изменился, просто обновим поле
        const oldKey = existing.key;

        try {
            const result = await db.transaction(async (trx: any) => {
                // Обновляем поле
                const updated = await fieldDAL.updateFieldFull(fieldId, { label, key, type, config }, trx);

                // Если ключ изменился — мигрируем данные участников в рамках той же транзакции
                if (oldKey !== key) {
                    // Обновляем participants.data: добавляем новое поле из старого и удаляем старый ключ
                    await trx('participants')
                        .where({ project_id: projectId })
                        .whereRaw('data ? ?', [oldKey])
                        .update({
                            data: trx.raw("(data || jsonb_build_object(?, data->?)) - ?", [key, oldKey, oldKey]),
                            updated_at: trx.fn.now(),
                        });
                }

                return updated;
            });

            if (!result) return dbError(res, "#UPDATEFIELD4");

            res.json(ProjectFieldHelper.toJSON(result));
        } catch (e) {
            console.error('[Field Update Error]', e);
            return dbError(res, "#UPDATEFIELD5");
        }
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
