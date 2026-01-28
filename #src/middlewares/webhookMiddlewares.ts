import { Request, Response, NextFunction } from "express";
import { webhooksDAL } from "../dal/webhooksDAL";
import { ProjectsDAL } from "../dal/projectsDAL";
import { errorSend, error404 } from "../utils/errors";
import { Webhook } from "../models/webhooks";

const projectsDAL = new ProjectsDAL();

// Расширяем Request для хранения webhook
declare global {
    namespace Express {
        interface Request {
            webhook?: Webhook;
        }
    }
}

/**
 * Проверка существования webhook по slug
 */
export const webhookExistsMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const slug = req.params.slug;

    if (!slug) {
        return errorSend(res, { message: "Slug вебхука не указан" });
    }

    const webhook = await webhooksDAL.getBySlug(slug);

    if (!webhook) {
        return error404(res, "Вебхук не найден");
    }

    req.webhook = webhook;
    next();
};

/**
 * Проверка что webhook активен (для публичного эндпоинта)
 */
export const webhookActiveMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const webhook = req.webhook;

    if (!webhook) {
        return error404(res, "Вебхук не найден");
    }

    if (!webhook.is_active) {
        return errorSend(res, { message: "Вебхук неактивен" }, { code: 403 });
    }

    next();
};

/**
 * Валидация данных при создании webhook
 */
export const validateCreateWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { projectId, name, slug, isActive } = req.body;

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

    // Проверка slug (опционально)
    if (slug !== undefined) {
        if (typeof slug !== "string") {
            errors.slug = "Slug должен быть строкой";
        } else if (slug.length < 3) {
            errors.slug = "Slug должен быть минимум 3 символа";
        } else if (slug.length > 100) {
            errors.slug = "Slug не должен превышать 100 символов";
        } else if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
            errors.slug = "Slug может содержать только латинские буквы, цифры, дефис и подчёркивание";
        } else {
            // Проверяем уникальность slug
            const existing = await webhooksDAL.getBySlug(slug);
            if (existing) {
                errors.slug = "Webhook с таким slug уже существует";
            }
        }
    }

    // Проверка name
    if (!name) {
        errors.name = "Название обязательно";
    } else if (typeof name !== "string") {
        errors.name = "Название должно быть строкой";
    } else if (name.length > 1000) {
        errors.name = "Название не должно превышать 1000 символов";
    }

    // Проверка isActive
    if (isActive !== undefined && typeof isActive !== "boolean") {
        errors.isActive = "isActive должен быть boolean";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

/**
 * Валидация данных при обновлении webhook
 */
export const validateUpdateWebhook = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { name, isActive } = req.body;
    const errors: Record<string, string> = {};

    // Проверка name
    if (name !== undefined) {
        if (typeof name !== "string") {
            errors.name = "Название должно быть строкой";
        } else if (name.length > 1000) {
            errors.name = "Название не должно превышать 1000 символов";
        } else if (name.length === 0) {
            errors.name = "Название не может быть пустым";
        }
    }

    // Проверка isActive
    if (isActive !== undefined && typeof isActive !== "boolean") {
        errors.isActive = "isActive должен быть boolean";
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    next();
};

/**
 * Логирование запросов к webhook
 * Записывает тело запроса и перехватывает ответ
 */
export const webhookLoggingMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const webhook = req.webhook;
    if (!webhook) {
        return next();
    }

    const startTime = Date.now();

    // Сохраняем данные запроса
    const requestData = {
        body: req.body,
        headers: {
            "content-type": req.headers["content-type"],
            "user-agent": req.headers["user-agent"],
            "x-forwarded-for": req.headers["x-forwarded-for"],
        },
        ip: req.ip || req.socket.remoteAddress,
    };

    // Логируем в консоль входящий запрос
    console.log("\n========== WEBHOOK REQUEST ==========");
    console.log(`[${new Date().toISOString()}] Webhook: ${webhook.slug}`);
    console.log("Request Body:", JSON.stringify(requestData.body, null, 2));
    console.log("======================================\n");

    // Перехватываем оригинальный res.json
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
        const duration = Date.now() - startTime;

        // Логируем в консоль ответ
        console.log("\n========== WEBHOOK RESPONSE ==========");
        console.log(`[${new Date().toISOString()}] Webhook: ${webhook.slug}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Duration: ${duration}ms`);
        console.log("Response Body:", JSON.stringify(body, null, 2));
        console.log("=======================================\n");

        // Сохраняем лог в БД (асинхронно, не блокируем ответ)
        webhooksDAL.createLog({
            webhookId: webhook.id,
            requestBody: requestData.body,
            requestHeaders: requestData.headers,
            responseStatus: res.statusCode,
            responseBody: body,
            errorMessage: res.statusCode >= 400 ? body?.message || body?.errors : null,
            ipAddress: requestData.ip || null,
        }).catch((err) => {
            console.error("Failed to save webhook log:", err);
        });

        return originalJson(body);
    };

    next();
};
