import { Request, Response, NextFunction } from "express";
import { body, param } from "express-validator";
import { projectAuthDAL, scannersDAL } from "../dal/scannersDAL";
import { inputValidationMiddleware } from "./common/inputValidationMiddleware";
import { ProjectsDAL } from "../dal/projectsDAL";
import { zonesDAL } from "../dal/zonesDAL";
import { Scanner, ProjectAuth } from "../models/scanners";
import { Project } from "../models/projects";
import { Zone } from "../models/zones";

const projectsDAL = new ProjectsDAL();

// Расширяем Request для сканера
declare global {
    namespace Express {
        interface Request {
            scannerAuth?: {
                projectAuth: ProjectAuth;
                project: Project;
                scanner?: Scanner;
            };
        }
    }
}

/**
 * Middleware для проверки авторизации сканера через заголовки
 * X-Access-Key и X-Secret-Key
 */
export const scannerAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const accessKey = req.headers["x-access-key"] as string;
    const secretKey = req.headers["x-secret-key"] as string;

    if (!accessKey || !secretKey) {
        return res.status(401).json({
            error: "Требуется авторизация сканера",
            code: "SCANNER_AUTH_REQUIRED",
        });
    }

    // Ищем авторизацию по access_key
    const projectAuth = await projectAuthDAL.getByAccessKey(accessKey);

    if (!projectAuth) {
        return res.status(401).json({
            error: "Неверные ключи авторизации",
            code: "INVALID_ACCESS_KEY",
        });
    }

    // Проверяем secret_key
    if (projectAuth.secret_key !== secretKey) {
        return res.status(401).json({
            error: "Неверные ключи авторизации",
            code: "INVALID_SECRET_KEY",
        });
    }

    // Получаем проект
    const project = await projectsDAL.findByPk(projectAuth.project_id);

    if (!project) {
        return res.status(404).json({
            error: "Проект не найден",
            code: "PROJECT_NOT_FOUND",
        });
    }

    // Сохраняем данные авторизации в request
    req.scannerAuth = {
        projectAuth,
        project,
    };

    next();
};

/**
 * Middleware для проверки что сканер зарегистрирован
 * Требует X-Scanner-Id заголовок
 */
export const scannerRegisteredMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.scannerAuth) {
        return res.status(401).json({
            error: "Требуется авторизация сканера",
            code: "SCANNER_AUTH_REQUIRED",
        });
    }

    const scannerId = req.headers["x-scanner-id"] as string;

    if (!scannerId) {
        return res.status(401).json({
            error: "Требуется идентификатор сканера",
            code: "SCANNER_ID_REQUIRED",
        });
    }

    // Ищем сканер
    const scanner = await scannersDAL.getByScannerId(scannerId);

    if (!scanner) {
        return res.status(401).json({
            error: "Сканер не зарегистрирован",
            code: "SCANNER_NOT_REGISTERED",
        });
    }

    // Проверяем что сканер принадлежит этому проекту
    if (scanner.project_id !== req.scannerAuth.project.id) {
        return res.status(403).json({
            error: "Сканер привязан к другому проекту",
            code: "SCANNER_WRONG_PROJECT",
        });
    }

    // Обновляем last_seen_at
    await scannersDAL.updateLastSeen(scanner.id);

    req.scannerAuth.scanner = scanner;

    next();
};

// ===== Валидация для join =====

const joinProjectSlugValidation = param("projectSlug")
    .notEmpty()
    .withMessage("projectSlug обязателен");

const joinZoneIdValidation = param("zoneId")
    .isInt({ min: 1 })
    .withMessage("zoneId должен быть числом");

const joinScannerValidation = body("scanner")
    .notEmpty()
    .isString()
    .withMessage("scanner обязателен");

/**
 * Middleware для проверки проекта и зоны при join
 */
const joinCheckProjectAndZone = async (
    req: Request & { project?: Project; zone?: Zone },
    res: Response,
    next: NextFunction
) => {
    const { projectSlug, zoneId } = req.params;

    // Получаем авторизацию
    if (!req.scannerAuth) {
        return res.status(401).json({
            error: "Требуется авторизация сканера",
            code: "SCANNER_AUTH_REQUIRED",
        });
    }

    // Проверяем что проект совпадает со slug
    const project = req.scannerAuth.project;
    if (project.slug !== projectSlug) {
        return res.status(403).json({
            error: "Ключи авторизации не соответствуют проекту",
            code: "PROJECT_MISMATCH",
        });
    }

    // Проверяем зону
    const zone = await zonesDAL.getById(Number(zoneId));
    if (!zone) {
        return res.status(404).json({
            error: "Зона не найдена",
            code: "ZONE_NOT_FOUND",
        });
    }

    if (zone.project_id !== project.id) {
        return res.status(403).json({
            error: "Зона не принадлежит проекту",
            code: "ZONE_WRONG_PROJECT",
        });
    }

    req.project = project;
    req.zone = zone;

    next();
};

// ===== Валидация для upload logs =====

const uploadLogsValidation = body("logs")
    .isArray({ min: 1 })
    .withMessage("logs должен быть непустым массивом");

const uploadLogItemValidation = [
    body("logs.*.userCode")
        .notEmpty()
        .isString()
        .withMessage("userCode обязателен"),
    body("logs.*.timestamp")
        .notEmpty()
        .isISO8601()
        .withMessage("timestamp должен быть в формате ISO8601"),
    body("logs.*.zone")
        .isInt({ min: 1 })
        .withMessage("zone должен быть числом"),
    body("logs.*.direction")
        .optional({ nullable: true })
        .isIn(["in", "out", null])
        .withMessage("direction должен быть 'in', 'out' или null"),
    body("logs.*.hash")
        .notEmpty()
        .isString()
        .isLength({ min: 32, max: 32 })
        .withMessage("hash должен быть MD5 хешем (32 символа)"),
];

// ===== Экспорт middleware массивов =====

export const joinMiddlewares = [
    scannerAuthMiddleware,
    joinProjectSlugValidation,
    joinZoneIdValidation,
    joinScannerValidation,
    inputValidationMiddleware,
    joinCheckProjectAndZone,
];

export const scannerGetProjectMiddlewares = [
    scannerAuthMiddleware,
    scannerRegisteredMiddleware,
];

export const scannerGetParticipantMiddlewares = [
    scannerAuthMiddleware,
    scannerRegisteredMiddleware,
    param("code").notEmpty().withMessage("code обязателен"),
    inputValidationMiddleware,
];

export const scannerUploadLogsMiddlewares = [
    scannerAuthMiddleware,
    scannerRegisteredMiddleware,
    uploadLogsValidation,
    ...uploadLogItemValidation,
    inputValidationMiddleware,
];
