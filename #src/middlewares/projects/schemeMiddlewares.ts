import { Request, Response, NextFunction } from "express";
import { body, param } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { adminRoles, operatorRoles } from "../../datas/rolesData";
import { ProjectsDAL } from "../../dal/projectsDAL";
import { ProjectFieldsDAL } from "../../dal/projectFieldsDAL";
import { ProjectFieldHelper, ProjectFieldType } from "../../models/projectFields";
import { wrap } from "../../utils/wrap";
import { errorSend, authError, error404 } from "../../utils/errors";

const projectDAL = new ProjectsDAL();
const fieldDAL = new ProjectFieldsDAL();

// ===== Валидация параметров =====

const projectIdParam = param("projectId")
    .notEmpty()
    .withMessage("ID проекта обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID проекта");

const fieldIdParam = param("fieldId")
    .notEmpty()
    .withMessage("ID поля обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID поля");

// ===== Валидация тела запроса для создания =====

const keyValidation = body("key")
    .notEmpty()
    .withMessage("Ключ обязателен")
    .isString()
    .withMessage("Ключ должен быть строкой")
    .isLength({ max: 1000 })
    .withMessage("Ключ не должен превышать 1000 символов");

const labelValidation = body("label")
    .notEmpty()
    .withMessage("Название обязательно")
    .isString()
    .withMessage("Название должно быть строкой")
    .isLength({ max: 1000 })
    .withMessage("Название не должно превышать 1000 символов");

const validFieldTypes: ProjectFieldType[] = ['text', 'list', 'bool', 'id', 'img', 'code'];

const configValidation = body("config")
    .notEmpty()
    .withMessage("Конфигурация обязательна")
    .isObject()
    .withMessage("Конфигурация должна быть объектом")
    .custom((config) => {
        const validation = ProjectFieldHelper.validateConfig(config);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        return true;
    });

// ===== Middleware проверки доступа =====

/**
 * Проверка доступа к схеме проекта
 * - Админ имеет доступ к любому проекту
 * - Оператор только к своему проекту
 */
const checkProjectAccess = (allowOperator: boolean = true) => {
    return async (req: Request, res: Response, next: NextFunction) => {
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
            return next();
        }

        // Оператор проверяется только если allowOperator = true
        if (!allowOperator) {
            return authError(res, "Недостаточно прав");
        }

        // Оператор имеет доступ только к своему проекту
        if (operatorRoles.includes(account.role)) {
            if (account.projectId !== projectId) {
                return authError(res, "Нет доступа к этому проекту");
            }
            req.project = project;
            return next();
        }

        return authError(res, "Недостаточно прав");
    };
};

/**
 * Проверка, что поле принадлежит указанному проекту
 */
const checkFieldBelongsToProject = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number(req.params.projectId);
    const fieldId = Number(req.params.fieldId);

    const [field] = await wrap(fieldDAL.getById(fieldId));
    if (!field) {
        return error404(res, "Поле не найдено");
    }

    if (field.project_id !== projectId) {
        return errorSend(res, { fieldId: "Поле не принадлежит указанному проекту" }, { code: 400 });
    }

    req.projectField = field;
    next();
};

/**
 * Проверка уникальности label и key в проекте
 */
const checkUniqueness = async (req: Request, res: Response, next: NextFunction) => {
    const { key, label } = req.body;
    const projectId = Number(req.params.projectId);

    // Проверка уникальности label
    const [isLabelUnique] = await wrap(fieldDAL.isLabelUnique(projectId, label));
    if (!isLabelUnique) {
        return errorSend(res, { label: `Поле с названием "${label}" уже существует в этом проекте` }, { code: 400 });
    }

    // Проверка уникальности key
    const [isKeyUnique] = await wrap(fieldDAL.isKeyUnique(projectId, key));
    if (!isKeyUnique) {
        return errorSend(res, { key: `Поле с ключом "${key}" уже существует в этом проекте` }, { code: 400 });
    }

    next();
};

/**
 * Проверка возможности редактирования поля
 */
const checkFieldEditable = async (req: Request, res: Response, next: NextFunction) => {
    const { config } = req.body;
    const existingField = req.projectField!;

    // Проверяем, что поле можно редактировать
    if (!ProjectFieldHelper.isEditable(existingField.config)) {
        return errorSend(res, { config: "Редактирование доступно только для полей типа list" }, { code: 400 });
    }

    // Проверяем, что тип не изменился
    if (config.type !== existingField.config.type) {
        return errorSend(res, { config: "Изменение типа поля запрещено" }, { code: 400 });
    }

    next();
};

// ===== Экспорт middleware =====

// GET /projects/:projectId/scheme - доступно админам и операторам своего проекта
export const getSchemeMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    inputValidationMiddleware,
    checkProjectAccess(true),
];

// POST /projects/:projectId/scheme - только админы
export const createFieldMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    keyValidation,
    labelValidation,
    configValidation,
    inputValidationMiddleware,
    checkProjectAccess(false),
    checkUniqueness,
];

// PUT /projects/:projectId/scheme/:fieldId - только админы
export const updateFieldMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    fieldIdParam,
    configValidation,
    inputValidationMiddleware,
    checkProjectAccess(false),
    checkFieldBelongsToProject,
    checkFieldEditable,
];

// DELETE /projects/:projectId/scheme/:fieldId - только админы
export const deleteFieldMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    fieldIdParam,
    inputValidationMiddleware,
    checkProjectAccess(false),
    checkFieldBelongsToProject,
];
