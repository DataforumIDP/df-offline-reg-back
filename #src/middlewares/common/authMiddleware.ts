// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { authError, errorSend } from "../../utils/errors";
import { wrap } from "../../utils/wrap";
import {Account} from "../../models/accounts";
import { JWT } from "../../utils/JWTutils";
import { AccountsDAL } from "../../dal/accountsDAL";

/**
 * Middleware для проверки JWT авторизации.
 * Если токен валиден, полезная нагрузка токена будет добавлена в req.account.
 * Если токен отсутствует или недействителен, возвращается 401 с сообщением об ошибке.
 */
export const authenticateJWT = (required: boolean = true) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Получение токена из заголовка Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader) return required ? authError(res) : next();
        
        // Ожидается формат "Bearer <token>"
        const token = authHeader.split(" ")[1];
        
        if (!token) return required ? authError(res) : next();

        // Проверка и декодирование токена
        const [data] = await wrap(JWT.verify(token)) as any;

        if(!data) return authError(res)

        const [account] = await wrap(
            new AccountsDAL().findByPk(data.payload.id)
        );

        if (account === null && required)
            return authError(res, "Неверный или истёкший токен.");

        if (account !== null) req.account = account;

        next();
    };
};
