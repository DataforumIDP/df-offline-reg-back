import { Request, Response, NextFunction } from "express";
import { serviceTokensDAL } from "../../dal/serviceTokensDAL";

/**
 * Middleware для аутентификации внешних сервисов по токену.
 *
 * Ожидает заголовок: Authorization: Bearer <token>
 *
 * Проверяет:
 * 1. Токен передан
 * 2. Токен существует в БД и не отозван
 * 3. IP-адрес запроса входит в allowed_ips (если список не пустой)
 */
export const serviceTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Токен не передан" });
    }

    const token = authHeader.slice(7);

    const serviceToken = await serviceTokensDAL.findByToken(token).catch(() => null);

    if (!serviceToken) {
        return res.status(401).json({ error: "Недействительный или отозванный токен" });
    }

    // Проверка IP только если список не пустой
    if (serviceToken.allowed_ips && serviceToken.allowed_ips.length > 0) {
        const clientIp = (req.ip || "").replace("::ffff:", "");

        if (!serviceToken.allowed_ips.includes(clientIp)) {
            return res.status(403).json({ error: "Доступ запрещён с данного IP" });
        }
    }

    // Сохраняем данные о сервисе в запросе для возможного использования в обработчиках
    (req as any).serviceToken = serviceToken;

    next();
};
