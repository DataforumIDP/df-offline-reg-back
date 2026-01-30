import { Request, Response, NextFunction } from "express";
import { printTemplatesDAL } from "../dal/printTemplatesDAL";
import { PrintTemplateHelper } from "../models/printTemplates";
import { wrap } from "../utils/wrap";
import { dbError, error404 } from "../utils/errors";
import { response201, response204 } from "../utils/responses";

class PrintTemplateService {
    /**
     * GET /print-templates
     * Получить все шаблоны
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const templates = await printTemplatesDAL.getAll({
                search: req.query.search as string,
            });

            res.json({
                templates: templates.map(PrintTemplateHelper.toJSON),
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /print-templates/:id
     * Получить шаблон по ID
     */
    async getOne(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const template = await printTemplatesDAL.getById(id);

            if (!template) {
                return error404(res, "Шаблон не найден");
            }

            res.json(PrintTemplateHelper.toJSON(template));
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /print-templates
     * Создать шаблон
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, settings, preloader } = req.body;

            const [template, err] = await wrap(
                printTemplatesDAL.create({ name, settings, preloader })
            );

            if (err || !template) {
                return dbError(res, "#CREATEPRINTTEMPLATE1");
            }

            response201(res, PrintTemplateHelper.toJSON(template));
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /print-templates/:id
     * Обновить шаблон
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const { name, settings, preloader } = req.body;

            const [template, err] = await wrap(
                printTemplatesDAL.update(id, { name, settings, preloader })
            );

            if (err) {
                return dbError(res, "#UPDATEPRINTTEMPLATE1");
            }

            if (!template) {
                return error404(res, "Шаблон не найден");
            }

            res.json(PrintTemplateHelper.toJSON(template));
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /print-templates/:id
     * Удалить шаблон
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);

            const deleted = await printTemplatesDAL.softDelete(id);

            if (!deleted) {
                return error404(res, "Шаблон не найден");
            }

            response204(res);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /projects/:projectId/print-template
     * Назначить шаблон проекту
     */
    async assignToProject(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = parseInt(req.params.projectId, 10);
            const { templateId } = req.body;

            // Проверяем существование шаблона
            const template = await printTemplatesDAL.getById(templateId);
            if (!template) {
                return error404(res, "Шаблон не найден");
            }

            await printTemplatesDAL.assignToProject(projectId, templateId);

            res.json({
                success: true,
                message: "Шаблон назначен проекту",
                template: PrintTemplateHelper.toJSON(template),
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /projects/:projectId/print-template
     * Удалить связь шаблона с проектом
     */
    async removeFromProject(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = parseInt(req.params.projectId, 10);

            await printTemplatesDAL.removeFromProject(projectId);

            response204(res);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /projects/:projectId/print-template
     * Получить шаблон проекта
     */
    
    async getByProject(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = parseInt(req.params.projectId, 10);

            const template = await printTemplatesDAL.getByProjectId(projectId);

            if (!template) {
                return res.json({ template: null });
            }

            res.json({
                template: PrintTemplateHelper.toJSON(template),
            });
        } catch (error) {
            next(error);
        }
    }
}

export const printTemplateService = new PrintTemplateService();
