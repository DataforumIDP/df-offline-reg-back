import { Router } from "express";
import { ProjectService } from "../services/projectService";
import { ProjectFieldService } from "../services/projectFieldService";
import { ParticipantService } from "../services/participantService";
import { participantLogService } from "../services/participantLogService";
import { printTemplateService } from "../services/printTemplateService";
import { createMiddlewares } from "../middlewares/projects/createMiddlewares";
import { updateMiddlewares } from "../middlewares/projects/updateMiddlewares";
import { deleteMiddlewares } from "../middlewares/projects/deleteMiddlewares";
import { getMiddlewares } from "../middlewares/projects/getMiddlewares";
import { getOneMiddlewares } from "../middlewares/projects/getOneMiddlewares";
import {
    getSchemeMiddlewares,
    createFieldMiddlewares,
    updateFieldMiddlewares,
    deleteFieldMiddlewares,
} from "../middlewares/projects/schemeMiddlewares";
import {
    getParticipantsMiddlewares,
    getParticipantMiddlewares,
    createParticipantMiddlewares,
    updateParticipantMiddlewares,
    deleteParticipantMiddlewares,
    getLogsMiddlewares,
    printParticipantMiddlewares,
} from "../middlewares/projects/participantMiddlewares";
import {
    assignTemplateMiddlewares,
    removeTemplateMiddlewares,
    getProjectTemplateMiddlewares,
} from "../middlewares/printTemplateMiddlewares";

export const projectsRouter = Router();

const project = new ProjectService();
const projectField = new ProjectFieldService();
const participant = new ParticipantService();

// ===== Роуты проектов =====
projectsRouter.post("/", createMiddlewares, project.create);
projectsRouter.patch("/:id", updateMiddlewares, project.update);
projectsRouter.get("/", getMiddlewares, project.get);
projectsRouter.get("/:id/users", getMiddlewares, project.getUsers);
projectsRouter.get("/:slugOrId", getOneMiddlewares, project.getOne);
projectsRouter.delete("/:id", deleteMiddlewares, project.delete);

// ===== Роуты схемы полей проекта =====
projectsRouter.get("/:projectId/scheme", getSchemeMiddlewares, projectField.getScheme);
projectsRouter.post("/:projectId/scheme", createFieldMiddlewares, projectField.createField);
projectsRouter.put("/:projectId/scheme/:fieldId", updateFieldMiddlewares, projectField.updateField);
projectsRouter.delete("/:projectId/scheme/:fieldId", deleteFieldMiddlewares, projectField.deleteField);

// ===== Роуты шаблонов печати проекта =====
projectsRouter.get("/:projectId/print-template", getProjectTemplateMiddlewares, printTemplateService.getByProject);
projectsRouter.post("/:projectId/print-template", assignTemplateMiddlewares, printTemplateService.assignToProject);
projectsRouter.delete("/:projectId/print-template", removeTemplateMiddlewares, printTemplateService.removeFromProject);

// ===== Роуты логов участников (должны быть ДО роутов с :participantId) =====
projectsRouter.get("/:projectId/participants/log/stats", getLogsMiddlewares, participantLogService.getStats);
projectsRouter.get("/:projectId/participants/log", getLogsMiddlewares, participantLogService.getAll);

// ===== Роуты участников проекта =====
projectsRouter.get("/:projectId/participants", getParticipantsMiddlewares, participant.getAll);
projectsRouter.get("/:projectId/participants/:participantId", getParticipantMiddlewares, participant.getOne);
projectsRouter.get("/:projectId/participants/:participantId/log", getParticipantMiddlewares, participantLogService.getByParticipant);
projectsRouter.post("/:projectId/participants", createParticipantMiddlewares, participant.create);
projectsRouter.post("/:projectId/participants/:participantId/print", printParticipantMiddlewares, participant.print);
projectsRouter.put("/:projectId/participants/:participantId", updateParticipantMiddlewares, participant.update);
projectsRouter.delete("/:projectId/participants/:participantId", deleteParticipantMiddlewares, participant.delete);
