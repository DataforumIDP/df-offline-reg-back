import { Router } from "express";
import { scannerService } from "../services/scannerService";
import {
    joinMiddlewares,
    scannerGetProjectMiddlewares,
    scannerGetParticipantMiddlewares,
    scannerUploadLogsMiddlewares,
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
