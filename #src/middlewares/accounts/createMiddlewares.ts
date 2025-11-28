import { body } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { authMiddlewares } from "./authMiddlewares";
import { wrap } from "../../utils/wrap";
import { AccountsDAL } from "../../dal/accountsDAL";
import { adminRoles, allRoles } from "../../datas/rolesData";
import { roleCheck } from "../common/roleCaheck";

const roleValidation = body("role")
    .optional()
    .isIn(allRoles)
    .withMessage("Некорректная роль");

export const existsLogin = body("login")
    .custom(async (login) => {
        const [account, err] = await wrap(new AccountsDAL().findOne({ login }));
        if (err !== null || account !== null) throw new Error();
        return true;
    })
    .withMessage("Логин уже занят");

export const createMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    roleValidation,
    existsLogin,
    ...authMiddlewares,
];
