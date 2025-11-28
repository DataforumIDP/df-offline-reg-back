import { FieldValidationError, validationResult } from "express-validator";
import { NextFunction, Request, Response } from "express";

export const inputValidationMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errData = validationResult(req);
    if (!errData.isEmpty()) {
        let errors = {};

        errData.array().map((item) => {
            const { msg, path } = item as FieldValidationError;
            errors[path] = msg;
        });

        res.status(400).json({ errors });
    } else {
        next();
    }
};
