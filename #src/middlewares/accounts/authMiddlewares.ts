import { body } from "express-validator";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";
import { lengthValidation } from "../common/lengthMiddleware";

export const loginValidation = lengthValidation("login", { min: 3, max: 120 });

export const passwordValidation = lengthValidation("password", {
    min: 3,
    max: 120,
});

export const authMiddlewares = [
    loginValidation,
    passwordValidation,
    inputValidationMiddleware,
];