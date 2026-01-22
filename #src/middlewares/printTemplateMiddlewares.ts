import { Request, Response, NextFunction } from "express";
import { body, param, query } from "express-validator";
import { authenticateJWT } from "./common/authMiddleware";
import { inputValidationMiddleware } from "./common/inputValidationMiddleware";
import { adminRoles, operatorRoles } from "../datas/rolesData";
import { ProjectsDAL } from "../dal/projectsDAL";
import { wrap } from "../utils/wrap";
import { authError, error404 } from "../utils/errors";

const projectDAL = new ProjectsDAL();

// ===== Валидация =====

const templateIdParam = param("id")
    .notEmpty()
    .withMessage("ID шаблона обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID шаблона");

const projectIdParam = param("projectId")
    .notEmpty()
    .withMessage("ID проекта обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID проекта");

const nameValidation = body("name")
    .notEmpty()
    .withMessage("Название шаблона обязательно")
    .isString()
    .withMessage("Название должно быть строкой")
    .isLength({ max: 1000 })
    .withMessage("Название не должно превышать 1000 символов");

const nameOptionalValidation = body("name")
    .optional()
    .isString()
    .withMessage("Название должно быть строкой")
    .isLength({ max: 1000 })
    .withMessage("Название не должно превышать 1000 символов");

const settingsValidation = body("settings")
    .optional()
    .isObject()
    .withMessage("settings должен быть объектом");

const preloaderValidation = body("preloader")
    .optional()
    .isString()
    .withMessage("preloader должен быть строкой");

const templateIdBodyValidation = body("templateId")
    .notEmpty()
    .withMessage("templateId обязателен")
    .isInt({ min: 1 })
    .withMessage("templateId должен быть положительным числом");

const searchQuery = query("search")
    .optional()
    .isString()
    .withMessage("search должен быть строкой");

// ===== Middleware проверки доступа =====

/**
 * Проверка что пользователь - админ
 */
const adminOnly = (req: Request, res: Response, next: NextFunction) => {
    const account = req.account!;

    if (!adminRoles.includes(account.role)) {
        return authError(res, "Недостаточно прав");
    }

    next();
};

/**
 * Проверка доступа к шаблону проекта
 * - Админ имеет доступ к любому проекту
 * - Оператор только к своему проекту
 */
const checkProjectAccessForTemplate = async (req: Request, res: Response, next: NextFunction) => {
    const account = req.account!;
    const projectId = Number(req.params.projectId);

    // Проверяем существование проекта
    const [project] = await wrap(projectDAL.findByPk(projectId));
    if (!project) {
        return error404(res, "Проект не найден");
    }

    // Админ имеет доступ ко всем проектам
    if (adminRoles.includes(account.role)) {
        req.project = project;
        req.appValues = { ...req.appValues, project };
        return next();
    }

    // Оператор имеет доступ только к своему проекту
    if (operatorRoles.includes(account.role)) {
        if (account.projectId !== projectId) {
            return authError(res, "Нет доступа к этому проекту");
        }
        req.project = project;
        req.appValues = { ...req.appValues, project };
        return next();
    }

    return authError(res, "Недостаточно прав");
};

/**
 * Проверка доступа к управлению шаблоном проекта (только админ)
 */
const checkProjectAccessAdminOnly = async (req: Request, res: Response, next: NextFunction) => {
    const account = req.account!;
    const projectId = Number(req.params.projectId);

    // Проверяем существование проекта
    const [project] = await wrap(projectDAL.findByPk(projectId));
    if (!project) {
        return error404(res, "Проект не найден");
    }

    // Только админ
    if (!adminRoles.includes(account.role)) {
        return authError(res, "Недостаточно прав");
    }

    req.project = project;
    req.appValues = { ...req.appValues, project };
    next();
};

// ===== Экспорт middleware =====

// GET /print-templates - только админы
export const getTemplatesMiddlewares = [
    authenticateJWT(true),
    searchQuery,
    inputValidationMiddleware,
    adminOnly,
];

// GET /print-templates/:id - только админы
export const getTemplateMiddlewares = [
    authenticateJWT(true),
    templateIdParam,
    inputValidationMiddleware,
    adminOnly,
];

// POST /print-templates - только админы
export const createTemplateMiddlewares = [
    authenticateJWT(true),
    nameValidation,
    settingsValidation,
    preloaderValidation,
    inputValidationMiddleware,
    adminOnly,
];

// PUT /print-templates/:id - только админы
export const updateTemplateMiddlewares = [
    authenticateJWT(true),
    templateIdParam,
    nameOptionalValidation,
    settingsValidation,
    preloaderValidation,
    inputValidationMiddleware,
    adminOnly,
];

// DELETE /print-templates/:id - только админы
export const deleteTemplateMiddlewares = [
    authenticateJWT(true),
    templateIdParam,
    inputValidationMiddleware,
    adminOnly,
];

// POST /projects/:projectId/print-template - только админы
export const assignTemplateMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    templateIdBodyValidation,
    inputValidationMiddleware,
    checkProjectAccessAdminOnly,
];

// DELETE /projects/:projectId/print-template - только админы
export const removeTemplateMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    inputValidationMiddleware,
    checkProjectAccessAdminOnly,
];

// GET /projects/:projectId/print-template - админы и операторы своего проекта
export const getProjectTemplateMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    inputValidationMiddleware,
    checkProjectAccessForTemplate,
];
