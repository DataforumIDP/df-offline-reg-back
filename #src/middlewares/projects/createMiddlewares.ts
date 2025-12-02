import { body } from "express-validator";
import { authenticateJWT } from "../common/authMiddleware";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";
import { inputValidationMiddleware } from "../common/inputValidationMiddleware";

const titleValidation = body("title")
    .notEmpty()
    .withMessage("Название обязательно")
    .isLength({ max: 128 })
    .withMessage("Название не должно превышать 128 символов");

const slugValidation = body("slug")
    .optional()
    .isLength({ max: 128 })
    .withMessage("Slug не должен превышать 128 символов");

const descriptionValidation = body("description")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Описание не должно превышать 200 символов");

const dateStartValidation = body("dateStart")
    .notEmpty()
    .withMessage("Дата начала обязательна")
    .isISO8601()
    .withMessage("Некорректный формат даты начала");

const dateEndValidation = body("dateEnd")
    .notEmpty()
    .withMessage("Дата окончания обязательна")
    .isISO8601()
    .withMessage("Некорректный формат даты окончания");

export const createMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
    titleValidation,
    slugValidation,
    descriptionValidation,
    dateStartValidation,
    dateEndValidation,
    inputValidationMiddleware,
];
