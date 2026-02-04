import { Router } from 'express'
import { zoneService } from '../services/zoneService'
import { authenticateJWT } from '../middlewares/common/authMiddleware'
import { roleCheck } from '../middlewares/common/roleCaheck'
import {
    zoneExistsMiddleware,
    validateCreateZone,
    validateUpdateZone,
    validateCreateRule,
} from '../middlewares/zoneMiddlewares'
import { adminRoles } from '../datas/rolesData'

const router = Router()

// Все эндпоинты требуют авторизации и роли админа

/**
 * GET /zones
 * Получение списка зон (с фильтрацией по projectId)
 */
router.get('/', authenticateJWT(), roleCheck(adminRoles), zoneService.getAll)

/**
 * GET /zones/:zoneId
 * Получение одной зоны
 */
router.get(
    '/:zoneId',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    zoneService.getOne
)

/**
 * POST /zones
 * Создание зоны
 */
router.post(
    '/',
    authenticateJWT(),
    roleCheck(adminRoles),
    validateCreateZone,
    zoneService.create
)

/**
 * PUT /zones/:zoneId
 * Обновление зоны
 */
router.put(
    '/:zoneId',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    validateUpdateZone,
    zoneService.update
)

/**
 * DELETE /zones/:zoneId
 * Удаление зоны
 */
router.delete(
    '/:zoneId',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    zoneService.delete
)

// ========== Правила доступа ==========

/**
 * POST /zones/:zoneId/rules
 * Добавление правила доступа
 */
router.post(
    '/:zoneId/rules',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    validateCreateRule,
    zoneService.createRule
)

/**
 * DELETE /zones/:zoneId/rules/:ruleId
 * Удаление правила доступа
 */
router.delete(
    '/:zoneId/rules/:ruleId',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    zoneService.deleteRule
)

/**
 * GET /zones/:zoneId/config
 * Получение конфига зоны для QR кода сканера
 */
router.get(
    '/:zoneId/config',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    zoneService.getConfig
)

/**
 * GET /zones/:zoneId/scanners
 * Получение списка устройств (сканеров) зоны с количеством логов
 */
router.get(
    '/:zoneId/scanners',
    authenticateJWT(),
    roleCheck(adminRoles),
    zoneExistsMiddleware,
    zoneService.getScanners
)

export const zonesRouter = router
