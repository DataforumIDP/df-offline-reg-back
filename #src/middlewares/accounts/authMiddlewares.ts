import { body } from "express-validator";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { sanitazerMiddleware } from "../common/sanitazerMiddleware";
import { lengthValidation } from "../common/lengthMiddleware";

export const loginValidation = lengthValidation("login", { min: 3, max: 120 });

export const passwordValidation = lengthValidation("password", {
    min: 3,
    max: 120,
});

export const authMiddlewares = [
    sanitazerMiddleware(["login", "password"], "body"),
    loginValidation,
    passwordValidation,
    inputValidationMiddleware,
];