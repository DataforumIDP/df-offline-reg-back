import { param } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";

const slugOrIdValidate = param("slugOrId")
    .notEmpty()
    .withMessage("Некорректное значение!");

export const getOneMiddlewares = [
    authenticateJWT(true),
    slugOrIdValidate,
    inputValidationMiddleware,
];
