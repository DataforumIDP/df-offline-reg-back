import { body } from "express-validator";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";

const projectValidation = body("project")
    .notEmpty()
    .withMessage("Проект обязателен")
    .isString()
    .withMessage("Проект должен быть строкой");

const nameValidation = body("name")
    .notEmpty()
    .withMessage("Имя обязательно")
    .isString()
    .withMessage("Имя должно быть строкой")
    .isLength({ max: 256 })
    .withMessage("Имя не должно превышать 256 символов");

export const registerMiddlewares = [
    projectValidation,
    nameValidation,
    inputValidationMiddleware,
];
