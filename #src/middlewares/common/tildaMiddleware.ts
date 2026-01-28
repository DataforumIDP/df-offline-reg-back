import { Request, Response, NextFunction } from "express";

export function tildaMiddleware(req: Request, res: Response, next: NextFunction) {
    // Если это тестовый запрос от Tilda, пропускаем валидацию
    if (req.body?.test) {
        return res.json()
    }

    return next();
}