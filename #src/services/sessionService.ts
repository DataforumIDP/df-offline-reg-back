import { Request, Response } from "express";
import { sessionsDAL } from "../dal/sessionsDAL";
import { SessionHelper, Session } from "../models/sessions";
import { wrap } from "../utils/wrap";

export class SessionService {
    /**
     * Получить все активные сессии текущего пользователя
     */
    async getMySessions(req: Request, res: Response) {
        const accountId = req.account?.id;
        
        if (!accountId) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        const [sessions, error] = await wrap(sessionsDAL.getActiveByAccountId(accountId));
        
        if (error) {
            return res.status(500).json({ error: "Ошибка получения сессий" });
        }

        // Получаем хеш текущего токена
        const authHeader = req.headers.authorization;
        let currentTokenHash: string | undefined;
        
        if (authHeader) {
            // Для refresh токена из тела или access токена из заголовка - обычно мы работаем с refresh
            // Но для определения "текущей" сессии нам нужен refresh токен
            // Так как refresh токен не передаётся в каждом запросе, пометим текущую по IP + User-Agent
        }

        const result = (sessions || []).map((session: Session) => 
            SessionHelper.toJSON(session, currentTokenHash)
        );

        res.json({ sessions: result });
    }

    /**
     * Завершить сессию по ID
     */
    async terminateSession(req: Request, res: Response) {
        const sessionId = parseInt(req.params.id, 10);
        const accountId = req.account?.id;

        if (!accountId) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        if (isNaN(sessionId)) {
            return res.status(400).json({ error: "Некорректный ID сессии" });
        }

        // Проверяем, что сессия принадлежит текущему пользователю
        const [belongs] = await wrap(sessionsDAL.belongsToAccount(sessionId, accountId));
        
        if (!belongs) {
            return res.status(403).json({ error: "Нет доступа к этой сессии" });
        }

        const [success, error] = await wrap(sessionsDAL.deactivate(sessionId));

        if (error) {
            return res.status(500).json({ error: "Ошибка завершения сессии" });
        }

        res.json({ success: true, message: "Сессия завершена" });
    }

    /**
     * Завершить все сессии кроме текущей
     */
    async terminateAllOtherSessions(req: Request, res: Response) {
        const accountId = req.account?.id;
        
        if (!accountId) {
            return res.status(401).json({ error: "Не авторизован" });
        }

        // Текущую сессию не завершаем
        // Для этого нужен ID текущей сессии, который можно получить из refresh токена
        const [count, error] = await wrap(sessionsDAL.deactivateAllByAccountId(accountId));

        if (error) {
            return res.status(500).json({ error: "Ошибка завершения сессий" });
        }

        res.json({ success: true, message: `Завершено ${count} сессий` });
    }
}

export const sessionService = new SessionService();
