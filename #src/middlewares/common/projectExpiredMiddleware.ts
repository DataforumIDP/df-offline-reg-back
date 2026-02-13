import { Request, Response, NextFunction } from "express";
import { ProjectsDAL } from "../../dal/projectsDAL";
import { wrap } from "../../utils/wrap";

const projectDAL = new ProjectsDAL();

/**
 * Middleware для проверки не истёк ли срок мероприятия (проекта)
 * Используется для операторских эндпоинтов после авторизации
 * 
 * Требует: req.account с projectId (для операторов)
 */
export const checkProjectNotExpired = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const account = req.account;

    // Пропускаем админов - у них нет привязки к проекту
    if (!account || account.role === 'admin') {
        return next();
    }

    // Для операторов проверяем проект
    const projectId = account.projectId;
    if (!projectId) {
        return res.status(403).json({
            error: "Оператор не привязан к проекту",
            code: "NO_PROJECT",
        });
    }

    const [project, err] = await wrap(projectDAL.findByPk(projectId));

    if (err || !project) {
        return res.status(404).json({
            error: "Проект не найден",
            code: "PROJECT_NOT_FOUND",
        });
    }

    const now = new Date();
    const endDate = new Date(project.dateEnd);

    if (endDate < now) {
        return res.status(403).json({
            error: "Мероприятие завершено",
            code: "PROJECT_EXPIRED",
        });
    }

    // Добавляем проект в request для дальнейшего использования
    req.operatorProject = project;

    next();
};
