import { Router } from "express";
import { webhookService } from "../services/webhookService";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { roleCheck } from "../middlewares/common/roleCaheck";
import {
    webhookExistsMiddleware,
    webhookActiveMiddleware,
    validateCreateWebhook,
    validateUpdateWebhook,
    webhookLoggingMiddleware,
} from "../middlewares/webhookMiddlewares";
import { adminRoles } from "../datas/rolesData";
import { tildaMiddleware } from "../middlewares/common/tildaMiddleware";

const router = Router();

//FIXME: везде .bind
// ========== Публичный эндпоинт для приёма данных ==========

/**
 * POST /webhooks/:slug
 * Публичный эндпоинт для приёма данных через webhook
 * Не требует авторизации!
 */
router.post(
    "/:slug",
    webhookExistsMiddleware,
    tildaMiddleware,
    webhookLoggingMiddleware, // Логируем запрос и ответ
    webhookActiveMiddleware,  // Проверяем что webhook активен
    webhookService.receive.bind(webhookService)
);

// ========== Административные эндпоинты ==========

/**
 * POST /webhooks
 * Создание webhook (только админ)
 */
router.post(
    "/",
    authenticateJWT(),
    roleCheck(adminRoles),
    validateCreateWebhook,
    webhookService.create.bind(webhookService)
);

/**
 * GET /webhooks/:slug
 * Получение webhook по slug (только админ)
 */
router.get(
    "/:slug",
    authenticateJWT(),
    roleCheck(adminRoles),
    webhookExistsMiddleware,
    webhookService.getOne.bind(webhookService)
);

/**
 * PUT /webhooks/:slug
 * Обновление webhook (только админ)
 */
router.put(
    "/:slug",
    authenticateJWT(),
    roleCheck(adminRoles),
    webhookExistsMiddleware,
    validateUpdateWebhook,
    webhookService.update.bind(webhookService)
);

/**
 * DELETE /webhooks/:slug
 * Удаление webhook (только админ)
 */
router.delete(
    "/:slug",
    authenticateJWT(),
    roleCheck(adminRoles),
    webhookExistsMiddleware,
    webhookService.delete.bind(webhookService)
);

/**
 * GET /webhooks/:slug/logs
 * Получение логов webhook (только админ)
 */
router.get(
    "/:slug/logs",
    authenticateJWT(),
    roleCheck(adminRoles),
    webhookExistsMiddleware,
    webhookService.getLogs.bind(webhookService)
);

export default router;
