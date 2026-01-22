import { Router } from "express";
import { printTemplateService } from "../services/printTemplateService";
import {
    getTemplatesMiddlewares,
    getTemplateMiddlewares,
    createTemplateMiddlewares,
    updateTemplateMiddlewares,
    deleteTemplateMiddlewares,
} from "../middlewares/printTemplateMiddlewares";

export const printTemplatesRouter = Router();

// GET /print-templates - получить все шаблоны
printTemplatesRouter.get("/", getTemplatesMiddlewares, printTemplateService.getAll);

// GET /print-templates/:id - получить шаблон по ID
printTemplatesRouter.get("/:id", getTemplateMiddlewares, printTemplateService.getOne);

// POST /print-templates - создать шаблон
printTemplatesRouter.post("/", createTemplateMiddlewares, printTemplateService.create);

// PUT /print-templates/:id - обновить шаблон
printTemplatesRouter.put("/:id", updateTemplateMiddlewares, printTemplateService.update);

// DELETE /print-templates/:id - удалить шаблон
printTemplatesRouter.delete("/:id", deleteTemplateMiddlewares, printTemplateService.delete);
