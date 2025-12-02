import { Request, Response } from "express";
import { ReqWithBody, ReqWithParams, ReqWithQuery } from "../baseTypes";
import { AccountsDAL as aDAL } from "../dal/accountsDAL";
import { authError, dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { JWT } from "../utils/JWTutils";
import { _offset } from "../utils/getOffset";
import { paginationResponse } from "../utils/paginationUtils";
import { filteredObjectByKeys } from "../utils/filteredObjectByKeys";
import { AccountHelper } from "../models/accounts";

const AccountDAL = new aDAL();

export class AccountService {
    async crete(
        req: ReqWithBody<{ login: string; password?: string; name?: string; role?: string }>,
        res: Response
    ) {
        const data = req.body;
        
        // Хешируем пароль и нормализуем логин
        if (data.password) {
            data.password = await AccountHelper.hashPassword(data.password);
        }
        data.login = AccountHelper.normalizeLogin(data.login);

        const [account] = await wrap(AccountDAL.create(data));
        if (!account) return dbError(res, "#ACCR1");

        response201(res, AccountHelper.toJSON(account));
    }

    /**
     *  Authorize by roles
     */
    authbr(roles: string[]) {
        return async (
            req: ReqWithBody<{ login: string; password: string }>,
            res: Response
        ) => {
            const { login, password } = req.body;

            const [account] = await wrap(
                AccountDAL.getByLoginAndRoles(login, roles, false),
                true
            );

            if (account === null)
                return authError(res, "Некорректный логин или пароль!");

            const isValid = await AccountHelper.validPassword(account, password);

            if (!isValid)
                return authError(res, "Некорректный логин или пароль!");

            const payload = AccountHelper.toJSON(account);

            const accessToken = JWT.createAccessToken(payload);
            const refreshToken = JWT.createRefreshToken(payload);

            res.json({
                message: "Вход выполнен успешно",
                accessToken,
                refreshToken,
                account: payload,
            });
        };
    }

    async refreshToken(
        req: ReqWithBody<{ refreshToken: string }>,
        res: Response
    ) {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: "Refresh токен обязателен"
            });
        }

        try {
            const [decoded] = await wrap(JWT.verifyRefreshToken(refreshToken)) as any;
            
            if (!decoded) {
                return res.status(401).json({
                    error: "Неверный refresh токен"
                });
            }

            // Проверяем, что пользователь все еще существует
            const [account] = await wrap(
                AccountDAL.findByPk(decoded.payload.id)
            );

            if (!account) {
                return res.status(401).json({
                    error: "Пользователь не найден"
                });
            }

            // Генерируем новый access токен
            const payload = AccountHelper.toJSON(account);
            const newAccessToken = JWT.createAccessToken(payload);

            return res.status(200).json({
                message: "Токен обновлен успешно",
                accessToken: newAccessToken,
                account: payload,
            });

        } catch (error) {
            console.error('RefreshToken error:', error);
            return res.status(401).json({
                error: "Неверный или истёкший refresh токен"
            });
        }
    }

    async self(req: Request, res: Response) {
        const { account } = req;

        const publicData = AccountHelper.toJSON(account!);

        res.json(publicData);
    }

    async get(
        req: ReqWithQuery<{ page?: string; search?: string; limit?: string }>,
        res: Response
    ) {
        const [accounts, meta] = await AccountDAL.get(req.query);

        if (!accounts) return dbError(res, "#GETac1");

        res.json(
            paginationResponse({
                list: accounts,
                all: Array.isArray(meta) ? 0 : meta.total,
                limit: req.query.limit,
                page: req.query.page,
            })
        );
    }

    async update(
        req: ReqWithBody<{ name?: string; login?: string; password?: string }>,
        res: Response
    ) {
        const { account } = req;
        const data = filteredObjectByKeys(req.body, ["name", "login", "password"]);

        // Хешируем пароль если он изменился
        if (data.password) {
            data.password = await AccountHelper.hashPassword(data.password);
        }
        if (data.login) {
            data.login = AccountHelper.normalizeLogin(data.login);
        }

        const [result] = await wrap(
            AccountDAL.updateOne(account!.id, data)
        );

        if (result === null) return dbError(res, "#UpdAcc1")

        res.json(AccountHelper.toJSON(result));
    }

    async delete(req: ReqWithBody<{ ids: number[] }>, res: Response) {
        const { ids } = req.body;
        const [result] = await wrap(AccountDAL._delete(ids));

        if (result === null) return dbError(res, "#DelAcc1");

        response204(res);
    }
}
