import { Request, Response, NextFunction } from "express";
import { zonesDAL } from "../dal/zonesDAL";
import { ProjectsDAL } from "../dal/projectsDAL";
import { errorSend, error404 } from "../utils/errors";
import { Zone } from "../models/zones";

const projectsDAL = new ProjectsDAL();

// Расширяем Request для хранения zone
declare global {
    namespace Express {
        interface Request {
            zone?: Zone;
        }
    }
}

/**
 * Проверка существования зоны по ID
 */
export const zoneExistsMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const zoneId = Number(req.params.zoneId);

    if (!zoneId || isNaN(zoneId)) {
        return errorSend(res, { message: "ID зоны не указан или некорректен" });
    }

    const zone = await zonesDAL.getById(zoneId);

    if (!zone) {
        return error404(res, "Зона не найдена");
    }

    req.zone = zone;
    next();
};

/**
 * Валидация данных при создании зоны
 */
export const validateCreateZone = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { projectId, name, free } = req.body;

    const errors: Record<string, string> = {};

    // Проверка projectId
    if (!projectId) {
        errors.projectId = "ID проекта обязателен";
    } else if (typeof projectId !== "number" || projectId <= 0) {
        errors.projectId = "Некорректный ID проекта";
    } else {
        // Проверяем существование проекта
        const project = await projectsDAL.findByPk(projectId);
        if (!project) {
            errors.projectId = "Проект не найден";
        }
    }

    // Проверка name
    if (!name) {
        errors.name = "Название зоны обязательно";
    } else if (typeof name !== "string") {
        errors.name = "Название должно быть строкой";
    } else if (name.length < 1) {
        errors.name = "Название не может быть пустым";
    } else if (name.length > 1000) {
        errors.name = "Название не должно превышать 1000 символов";
    }

    // Проверка free (опционально)
    if (free !== undefined && typeof free !== "boolean") {
        errors.free = "Поле free должно быть булевым значением";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

/**
 * Валидация данных при обновлении зоны
 */
export const validateUpdateZone = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { name, free } = req.body;

    const errors: Record<string, string> = {};

    // Проверка name (опционально)
    if (name !== undefined) {
        if (typeof name !== "string") {
            errors.name = "Название должно быть строкой";
        } else if (name.length < 1) {
            errors.name = "Название не может быть пустым";
        } else if (name.length > 1000) {
            errors.name = "Название не должно превышать 1000 символов";
        }
    }

    // Проверка free (опционально)
    if (free !== undefined && typeof free !== "boolean") {
        errors.free = "Поле free должно быть булевым значением";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

/**
 * Валидация данных при создании правила
 */
export const validateCreateRule = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { listItem } = req.body;

    const errors: Record<string, string> = {};

    // Проверка listItem
    if (!listItem) {
        errors.listItem = "Значение listItem обязательно";
    } else if (typeof listItem !== "string") {
        errors.listItem = "listItem должно быть строкой";
    } else if (listItem.length < 1) {
        errors.listItem = "listItem не может быть пустым";
    } else if (listItem.length > 255) {
        errors.listItem = "listItem не должен превышать 255 символов";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};
