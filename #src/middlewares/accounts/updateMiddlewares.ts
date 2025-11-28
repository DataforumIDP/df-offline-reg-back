import { exists } from "async-file";
import { authenticateJWT } from "../common/authMiddleware";
import { param } from "express-validator";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { existsEntity } from "../existsEntity";
import Accounts from "../../models/accounts";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";

const idValidate = param('id').notEmpty().withMessage("Некорректное значение!")

export const updateMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    idValidate,
    inputValidationMiddleware,
    existsEntity({model: Accounts, entityKey: "account"})
]