import { Router } from "express";
import { param, query } from "express-validator";
import { serviceTokenMiddleware } from "../middlewares/common/serviceTokenMiddleware";
import { inputValidationMiddleware } from "../middlewares/common/inputValidationMiddleware";
import { loadProject, loadParticipant } from "../middlewares/api/loadMiddlewares";
import { ParticipantService, ParticipantCodeService } from "../services/participantService";
import { ProjectService } from "../services/projectService";
import { ProjectFieldService } from "../services/projectFieldService";

export const apiRouter = Router();

const participantService = new ParticipantService();
const participantCodeService = new ParticipantCodeService();
const projectService = new ProjectService();
const projectFieldService = new ProjectFieldService();

// ===== Валидаторы =====

const projectIdParam = param("projectId")
    .notEmpty().withMessage("ID проекта обязателен")
    .isInt({ min: 1 }).withMessage("Некорректный ID проекта");

const participantIdParam = param("participantId")
    .notEmpty().withMessage("ID участника обязателен")
    .isInt({ min: 1 }).withMessage("Некорректный ID участника");

const slugOrIdParam = param("slugOrId")
    .notEmpty().withMessage("Некорректное значение");

const codeParam = param("code")
    .notEmpty().withMessage("Код обязателен");

const pageQuery = query("page").optional().isInt({ min: 1 }).withMessage("Некорректный номер страницы");
const limitQuery = query("limit").optional().isInt({ min: 1, max: 10000 }).withMessage("Лимит от 1 до 10000");
const directionQuery = query("direction").optional().isIn(["ASC", "DESC", "asc", "desc"]).withMessage("Некорректное направление");

// Все маршруты в этом роутере требуют сервисный токен
apiRouter.use(serviceTokenMiddleware);

// ===== Проекты =====

// GET /api/projects — список проектов
apiRouter.get(
    "/projects",
    [pageQuery, limitQuery, inputValidationMiddleware],
    projectService.get
);

// GET /api/projects/:slugOrId — один проект
apiRouter.get(
    "/projects/:slugOrId",
    [slugOrIdParam, inputValidationMiddleware],
    projectService.getOne
);

// ===== Схема полей проекта =====

// GET /api/projects/:projectId/scheme — схема полей
apiRouter.get(
    "/projects/:projectId/scheme",
    [projectIdParam, inputValidationMiddleware, loadProject],
    projectFieldService.getScheme
);

// ===== Участники =====

// GET /api/projects/:projectId/participants — список участников
apiRouter.get(
    "/projects/:projectId/participants",
    [projectIdParam, pageQuery, limitQuery, directionQuery, inputValidationMiddleware, loadProject],
    participantService.getAll
);

// GET /api/projects/:projectId/participants/:participantId — один участник
apiRouter.get(
    "/projects/:projectId/participants/:participantId",
    [projectIdParam, participantIdParam, inputValidationMiddleware, loadProject, loadParticipant],
    participantService.getOne
);

// GET /api/projects/:projectId/code/:code — поиск по QR-коду
apiRouter.get(
    "/projects/:projectId/code/:code",
    [projectIdParam, codeParam, inputValidationMiddleware, loadProject],
    participantCodeService.findByCode
);
