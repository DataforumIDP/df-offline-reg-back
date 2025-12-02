import { body } from "express-validator";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";

export const refreshMiddlewares = [
    body("refreshToken")
        .isString()
        .withMessage("refreshToken должен быть строкой")
        .notEmpty()
        .withMessage("refreshToken обязателен"),
    inputValidationMiddleware,
];
