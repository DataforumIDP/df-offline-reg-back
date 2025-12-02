import { param } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";

const idValidate = param("id")
    .notEmpty()
    .withMessage("Некорректное значение!");

export const deleteMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    idValidate,
    inputValidationMiddleware,
];
