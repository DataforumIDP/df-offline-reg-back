import { Request, Response, NextFunction } from "express";
import { param } from "express-validator";
import { authenticateJWT } from "./common/authMiddleware";
import { inputValidationMiddleware } from "./common/inputValidationMiddleware";
import { adminRoles } from "../datas/rolesData";
import { authError } from "../utils/errors";

const adminOnly = (req: Request, res: Response, next: NextFunction) => {
    if (!adminRoles.includes(req.account!.role)) {
        return authError(res, "Недостаточно прав");
    }
    next();
};

const fontIdParam = param("id")
    .notEmpty()
    .isInt({ min: 1 })
    .withMessage("Некорректный ID шрифта");

// GET /cloud-fonts
export const getCloudFontsMiddlewares = [authenticateJWT(true)];

// POST /cloud-fonts
export const createCloudFontMiddlewares = [authenticateJWT(true), adminOnly];

// DELETE /cloud-fonts/:id
export const deleteCloudFontMiddlewares = [
    authenticateJWT(true),
    adminOnly,
    fontIdParam,
    inputValidationMiddleware,
];
