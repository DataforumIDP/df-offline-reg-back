import { Router } from "express";
import { sessionService } from "../services/sessionService";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { roleCheck } from "../middlewares/common/roleCaheck";
import { adminRoles } from "../datas/rolesData";

export const sessionsRouter = Router();

// Все роуты требуют авторизации админа
const adminAuth = [authenticateJWT(), roleCheck(adminRoles)];

// Получить свои сессии
sessionsRouter.get("/", adminAuth, sessionService.getMySessions);

// Завершить конкретную сессию
sessionsRouter.delete("/:id", adminAuth, sessionService.terminateSession);

// Завершить все сессии кроме текущей
sessionsRouter.delete("/", adminAuth, sessionService.terminateAllOtherSessions);
