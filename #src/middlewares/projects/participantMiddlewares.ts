import { Request, Response, NextFunction } from "express";
import { body, param, query } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { adminRoles, operatorRoles } from "../../datas/rolesData";
import { ProjectsDAL } from "../../dal/projectsDAL";
import { ParticipantsDAL } from "../../dal/participantsDAL";
import { ProjectFieldsDAL } from "../../dal/projectFieldsDAL";
import { ProjectField, ProjectFieldConfig } from "../../models/projectFields";
import { wrap } from "../../utils/wrap";
import { errorSend, authError, error404 } from "../../utils/errors";

const projectDAL = new ProjectsDAL();
const participantDAL = new ParticipantsDAL();
const fieldDAL = new ProjectFieldsDAL();

// ===== Валидация параметров =====

const projectIdParam = param("projectId")
    .notEmpty()
    .withMessage("ID проекта обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID проекта");

const participantIdParam = param("participantId")
    .notEmpty()
    .withMessage("ID участника обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID участника");

// ===== Валидация query параметров =====

const pageQuery = query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Номер страницы должен быть положительным числом");

const limitQuery = query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Лимит должен быть от 1 до 100");

const directionQuery = query("direction")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Направление сортировки должно быть ASC или DESC");

// ===== Валидация тела запроса =====

const dataValidation = body()
    .isObject()
    .withMessage("Данные должны быть объектом");

// ===== Middleware проверки доступа =====

/**
 * Проверка доступа к участникам проекта
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
            req.appValues = { ...req.appValues, project };
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
            req.appValues = { ...req.appValues, project };
            return next();
        }

        return authError(res, "Недостаточно прав");
    };
};

/**
 * Проверка, что участник принадлежит указанному проекту
 */
const checkParticipantBelongsToProject = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number(req.params.projectId);
    const participantId = Number(req.params.participantId);

    const [participant] = await wrap(participantDAL.getByIdAndProject(participantId, projectId));
    if (!participant) {
        return error404(res, "Участник не найден");
    }

    req.participant = participant;
    next();
};

/**
 * Валидация данных участника по схеме проекта
 * - Проверяет соответствие типам полей
 * - Генерирует значения для полей типа id
 * - Проверяет уникальность полей с uniq=true
 * - Проверяет значения list на вхождение в список
 */
const validateParticipantData = (isUpdate: boolean = false) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const projectId = Number(req.params.projectId);
        const participantId = isUpdate ? Number(req.params.participantId) : undefined;
        const data = req.body;

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields || fields.length === 0) {
            // Если схемы нет, пропускаем валидацию
            return next();
        }

        const errors: Record<string, string> = {};
        const validatedData: Record<string, any> = {};

        for (const field of fields) {
            const { key, label, config } = field;
            const value = data[key];

            // Обработка поля типа id - автогенерация
            if (config.type === 'id') {
                if (!isUpdate) {
                    // При создании генерируем новый id
                    const [maxId] = await wrap(participantDAL.getMaxIdFieldValue(projectId, key));
                    validatedData[key] = (maxId || 0) + 1;
                } else {
                    // При обновлении сохраняем существующий id
                    const existingParticipant = req.participant!;
                    validatedData[key] = existingParticipant.data[key];
                }
                continue;
            }

            // Проверка обязательности (все поля кроме id обязательны при создании)
            if (value === undefined || value === null || value === '') {
                if (!isUpdate) {
                    errors[key] = `Поле "${label}" обязательно для заполнения`;
                }
                continue;
            }

            // Валидация по типу поля
            const validationError = validateFieldValue(value, config, label);
            if (validationError) {
                errors[key] = validationError;
                continue;
            }

            // Проверка уникальности
            if (config.uniq) {
                const [isUnique] = await wrap(
                    participantDAL.isFieldValueUnique(projectId, key, value, participantId)
                );
                if (!isUnique) {
                    errors[key] = `Значение поля "${label}" уже используется`;
                    continue;
                }
            }

            validatedData[key] = value;
        }

        // Если есть ошибки - возвращаем их все
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Заменяем данные на валидированные
        req.body = validatedData;
        next();
    };
};

/**
 * Валидация значения поля по его типу
 */
function validateFieldValue(
    value: any,
    config: ProjectFieldConfig,
    label: string
): string | null {
    switch (config.type) {
        case 'text':
            if (typeof value !== 'string') {
                return `Поле "${label}" должно быть строкой`;
            }
            if (config.maxLength && value.length > config.maxLength) {
                return `Поле "${label}" не должно превышать ${config.maxLength} символов`;
            }
            break;

        case 'bool':
            if (typeof value !== 'boolean') {
                return `Поле "${label}" должно быть булевым значением`;
            }
            break;

        case 'list':
            if (!config.listSettings) {
                return `Некорректная конфигурация поля "${label}"`;
            }

            const allowedValues = config.listSettings.items.map(item => item.value);

            if (config.listSettings.multiple) {
                // Множественный выбор - должен быть массив
                if (!Array.isArray(value)) {
                    return `Поле "${label}" должно быть массивом`;
                }
                const invalidValues = value.filter(v => !allowedValues.includes(v));
                if (invalidValues.length > 0) {
                    return `Поле "${label}" содержит недопустимые значения: ${invalidValues.join(', ')}`;
                }
            } else {
                // Одиночный выбор
                if (!allowedValues.includes(value)) {
                    return `Недопустимое значение поля "${label}". Доступные: ${allowedValues.join(', ')}`;
                }
            }
            break;

        case 'img':
            if (typeof value !== 'string') {
                return `Поле "${label}" должно быть строкой (путь к изображению)`;
            }
            break;

        case 'code':
            if (typeof value !== 'string') {
                return `Поле "${label}" должно быть строкой`;
            }
            break;

        // type 'id' обрабатывается отдельно
    }

    return null;
}

// ===== Экспорт middleware =====

// GET /projects/:projectId/participants - доступно админам и операторам своего проекта
export const getParticipantsMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    pageQuery,
    limitQuery,
    directionQuery,
    inputValidationMiddleware,
    checkProjectAccess(true),
];

// GET /projects/:projectId/participants/:participantId - доступно админам и операторам
export const getParticipantMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    participantIdParam,
    inputValidationMiddleware,
    checkProjectAccess(true),
    checkParticipantBelongsToProject,
];

// POST /projects/:projectId/participants - доступно админам и операторам
export const createParticipantMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    dataValidation,
    inputValidationMiddleware,
    checkProjectAccess(true),
    validateParticipantData(false),
];

// PUT /projects/:projectId/participants/:participantId - доступно админам и операторам
export const updateParticipantMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    participantIdParam,
    dataValidation,
    inputValidationMiddleware,
    checkProjectAccess(true),
    checkParticipantBelongsToProject,
    validateParticipantData(true),
];

// DELETE /projects/:projectId/participants/:participantId - только админы
export const deleteParticipantMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    participantIdParam,
    inputValidationMiddleware,
    checkProjectAccess(false), // Только админы
    checkParticipantBelongsToProject,
];

// GET /projects/:projectId/participants/log - только админы
export const getLogsMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    pageQuery,
    limitQuery,
    query("action")
        .optional()
        .isIn(["CREATE", "UPDATE", "DELETE", "PRINT"])
        .withMessage("action должен быть CREATE, UPDATE, DELETE или PRINT"),
    query("actor")
        .optional()
        .isIn(["USER", "WEBHOOK", "AUTO"])
        .withMessage("actor должен быть USER, WEBHOOK или AUTO"),
    query("participantId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("participantId должен быть положительным числом"),
    query("userId")
        .optional()
        .isInt({ min: 1 })
        .withMessage("userId должен быть положительным числом"),
    query("dateStart")
        .optional()
        .isISO8601()
        .withMessage("dateStart должен быть в формате ISO 8601"),
    query("dateEnd")
        .optional()
        .isISO8601()
        .withMessage("dateEnd должен быть в формате ISO 8601"),
    inputValidationMiddleware,
    checkProjectAccess(false), // Только админы
];

// POST /projects/:projectId/participants/:participantId/print - доступно админам и операторам
export const printParticipantMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    participantIdParam,
    inputValidationMiddleware,
    checkProjectAccess(true),
    checkParticipantBelongsToProject,
];
