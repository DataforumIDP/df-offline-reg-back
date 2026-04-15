import { Router } from "express";
import { scannerService } from "../services/scannerService";
import {
    joinMiddlewares,
    scannerGetProjectMiddlewares,
    scannerGetParticipantMiddlewares,
    scannerUploadLogsMiddlewares,
    scannerCheckoutMiddlewares,
    scannerCheckinMiddlewares,
    scannerMarkMiddlewares,
} from "../middlewares/scannerMiddlewares";

export const scannerRouter = Router();

/**
 * POST /scanner/join/:projectSlug/zone/:zoneId
 * Подключение сканера к проекту и зоне
 * Требует: X-Access-Key, X-Secret-Key заголовки
 * Body: { scanner: string }
 */
scannerRouter.post(
    "/join/:projectSlug/zone/:zoneId",
    joinMiddlewares,
    scannerService.join
);

/**
 * GET /scanner/project
 * Получение сведений о проекте и схеме
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 */
scannerRouter.get(
    "/project",
    scannerGetProjectMiddlewares,
    scannerService.getProject
);

/**
 * GET /scanner/participants/code/:code
 * Получение участника по коду
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 */
scannerRouter.get(
    "/participants/code/:code",
    scannerGetParticipantMiddlewares,
    scannerService.getParticipantByCode
);

/**
 * POST /scanner/logs/upload
 * Выгрузка логов сканера
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 * Body: { logs: ScannerLogUploadItem[] }
 */
scannerRouter.post(
    "/logs/upload",
    scannerUploadLogsMiddlewares,
    scannerService.uploadLogs
);

//FIXME: .bind x3

/**
 * POST /scanner/checkout
 * Отметить устройство как выданное
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 */
scannerRouter.post(
    "/checkout",
    scannerCheckoutMiddlewares,
    scannerService.checkout.bind(scannerService)
);

/**
 * POST /scanner/checkin
 * Отметить устройство как сданное
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 */
scannerRouter.post(
    "/checkin",
    scannerCheckinMiddlewares,
    scannerService.checkin.bind(scannerService)
);

/**
 * POST /scanner/mark/:participantId
 * Отметить участника (isMark-поле → true)
 * Требует: X-Access-Key, X-Secret-Key, X-Scanner-Id заголовки
 */
scannerRouter.post(
    "/mark/:participantId",
    scannerMarkMiddlewares,
    scannerService.markParticipant.bind(scannerService)
);

// ===== Роуты журнала устройств для сканера =====

/**
 * POST /scanner/journal/checkout
 * Выдать устройство участнику
 * Body: { userCode: string, userName?: string, participantId?: number }
 */
scannerRouter.post(
    "/journal/checkout",
    scannerGetProjectMiddlewares,
    scannerService.journalCheckout.bind(scannerService)
);

/**
 * POST /scanner/journal/checkin
 * Сдать устройство (по коду участника)
 * Body: { userCode: string }
 */
scannerRouter.post(
    "/journal/checkin",
    scannerGetProjectMiddlewares,
    scannerService.journalCheckin.bind(scannerService)
);

/**
 * GET /scanner/journal/status/:userCode
 * Проверить статус участника (есть ли активная выдача)
 */
scannerRouter.get(
    "/journal/status/:userCode",
    scannerGetProjectMiddlewares,
    scannerService.journalStatus.bind(scannerService)
);

/**
 * POST /scanner/journal/toggle
 * Переключить состояние: если нет активной записи - checkout, если есть - checkin
 * Body: { userCode: string, userName?: string, participantId?: number }
 */
scannerRouter.post(
    "/journal/toggle",
    scannerGetProjectMiddlewares,
    scannerService.journalToggle.bind(scannerService)
);
