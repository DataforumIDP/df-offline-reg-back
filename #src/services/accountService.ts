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

const AccountDAL = new aDAL();

export class AccountService {
    async crete(
        req: ReqWithBody<{ login: string; password?: string }>,
        res: Response
    ) {
        const data = req.body;
        const [account] = await wrap(AccountDAL.create(data));
        if (!account) return dbError(res, "#ACCR1");

        response201(res, account);
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

            const isValid = await account.validPassword(password);

            if (!isValid)
                return authError(res, "Некорректный логин или пароль!");

            const payload = account.toJSON();

            const token = JWT.create(payload);

            res.json({
                message: "Вход выполнен успешно",
                token,
                user: payload,
            });
        };
    }

    async self(req: Request, res: Response) {
        const { account } = req;
        res.json(account);
    }

    async get(
        req: ReqWithQuery<{ page?: string; search?: string; limit?: string }>,
        res: Response
    ) {
        const [acountsPromise, allPromise] = AccountDAL.get(req.query);

        const [accounts, accountsErr] = await wrap(acountsPromise, true);
        const [all, allErr] = await wrap(allPromise, true);

        if ([!!accountsErr, !!allErr].includes(true))
            return dbError(res, "#GETac1");

        res.json(
            paginationResponse({
                list: accounts,
                all,
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
        const data = filteredObjectByKeys(req.body, ["name", "login", "password"])

        const [result] = await wrap(
            AccountDAL.updateOne(account!, data)
        );

        if (result === null) return dbError(res, "#UpdAcc1")

        res.json(result);
    }

    async delete(req: ReqWithBody<{ ids: string[] }>, res: Response) {
        const { ids } = req.body;
        const [result] = await wrap(AccountDAL._delete(ids));

        if (result === null) return dbError(res, "#DelAcc1");

        response204(res);
    }
}
