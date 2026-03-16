import { Router } from "express";
import { sessionService } from "../services/sessionService";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { roleCheck } from "../middlewares/common/roleCaheck";
import { adminRoles } from "../datas/rolesData";

export const sessionsRouter = Router();

// Все роуты требуют авторизации админа
const adminAuth = [authenticateJWT(), roleCheck(adminRoles)];

//FIXME: .bind x3

// Получить свои сессии
sessionsRouter.get("/", adminAuth, sessionService.getMySessions.bind(sessionService));

// Завершить конкретную сессию
sessionsRouter.delete("/:id", adminAuth, sessionService.terminateSession.bind(sessionService));

// Завершить все сессии кроме текущей
sessionsRouter.delete("/", adminAuth, sessionService.terminateAllOtherSessions.bind(sessionService));
