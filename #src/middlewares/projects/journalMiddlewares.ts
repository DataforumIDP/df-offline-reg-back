import { Request, Response, NextFunction } from "express";
import { param } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { adminRoles } from "../../datas/rolesData";
import { ProjectsDAL } from "../../dal/projectsDAL";
import { wrap } from "../../utils/wrap";
import { error404, authError } from "../../utils/errors";

const projectDAL = new ProjectsDAL();

// Валидация параметров
const projectIdParam = param("projectId")
    .notEmpty()
    .withMessage("ID проекта обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID проекта");

const recordIdParam = param("recordId")
    .notEmpty()
    .withMessage("ID записи обязателен")
    .isInt({ min: 1 })
    .withMessage("Некорректный ID записи");

/**
 * Проверка доступа к журналу (только админы)
 */
const checkJournalAccess = async (req: Request, res: Response, next: NextFunction) => {
    const account = req.account!;
    const projectId = Number(req.params.projectId);

    // Проверяем существование проекта
    const [project] = await wrap(projectDAL.findByPk(projectId));
    if (!project) {
        return error404(res, "Проект не найден");
    }

    // Только админ имеет доступ к журналу
    if (!adminRoles.includes(account.role)) {
        return authError(res, "Недостаточно прав");
    }

    // Проверяем, включён ли журнал для проекта
    const journalEnabled = project.journal_enabled ?? false;
    if (!journalEnabled) {
        return res.status(400).json({
            error: "Журнал не включён для данного проекта",
            code: "JOURNAL_DISABLED",
        });
    }

    req.project = project;
    next();
};

// GET /projects/:projectId/journal
export const getJournalMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    inputValidationMiddleware,
    checkJournalAccess,
];

// GET /projects/:projectId/journal/stats
export const getJournalStatsMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    inputValidationMiddleware,
    checkJournalAccess,
];

// POST /projects/:projectId/journal/:recordId/return
export const returnJournalMiddlewares = [
    authenticateJWT(true),
    projectIdParam,
    recordIdParam,
    inputValidationMiddleware,
    checkJournalAccess,
];
