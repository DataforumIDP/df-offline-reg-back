import { body } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";


export const idsValidete = body("ids").isArray().withMessage("Некорректное значение!")

export const deleteMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    idsValidete,
    inputValidationMiddleware
]