import { param, body } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { authenticateJWT } from "../common/authMiddleware";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { existsEntity } from "../existsEntity";
import { ProjectHelper } from "../../models/projects";
import { filteredObjectByKeys } from "../../utils/filteredObjectByKeys";

const idValidate = param("id")
    .notEmpty()
    .withMessage("Некорректное значение!");

const dateStartValidation = body("dateStart")
    .optional()
    .isISO8601()
    .withMessage("Некорректный формат даты начала");

const dateEndValidation = body("dateEnd")
    .optional()
    .isISO8601()
    .withMessage("Некорректный формат даты окончания");

// Middleware для фильтрации полей и преобразования дат
const processUpdateData = (req: Request, res: Response, next: NextFunction) => {
    const data: any = filteredObjectByKeys(req.body, [
        "title",
        "slug",
        "description",
        "dateStart",
        "dateEnd",
        "isOperatorEditable",
        "colorRow",
        "rulesField",
        "scanMode",
        "journalEnabled"
    ]);

    // Преобразуем даты в Date объекты если они есть
    if (data.dateStart) data.dateStart = new Date(data.dateStart);
    if (data.dateEnd) data.dateEnd = new Date(data.dateEnd);

    // Преобразуем rulesField в rules_field для БД
    if ('rulesField' in data) {
        data.rules_field = data.rulesField;
        delete data.rulesField;
    }

    // Преобразуем scanMode в scan_mode для БД
    if ('scanMode' in data) {
        data.scan_mode = data.scanMode;
        delete data.scanMode;
    }

    req.body = data;
    next();
};

// Middleware для валидации дат
const validateDates = async (req: Request & { project?: any }, res: Response, next: NextFunction) => {
    const { dateStart, dateEnd } = req.body;
    const project = req.project;

    // Проверяем валидность дат если обе указаны
    if (dateStart && dateEnd) {
        if (!ProjectHelper.validateDates(dateStart, dateEnd)) {
            return res.status(400).json({
                error: "Дата окончания не может быть раньше даты начала",
            });
        }
    }

    // Если обновляется только одна дата, проверяем с текущими значениями
    if ((dateStart && !dateEnd) || (!dateStart && dateEnd)) {
        if (!project) {
            return res.status(404).json({ error: "Проект не найден" });
        }

        const startDate = dateStart || project.dateStart;
        const endDate = dateEnd || project.dateEnd;

        if (!ProjectHelper.validateDates(startDate, endDate)) {
            return res.status(400).json({
                error: "Дата окончания не может быть раньше даты начала",
            });
        }
    }

    next();
};

export const updateMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    idValidate,
    dateStartValidation,
    dateEndValidation,
    inputValidationMiddleware,
    existsEntity({ tableName: "projects", entityKey: "project" }),
    processUpdateData,
    validateDates,
];

