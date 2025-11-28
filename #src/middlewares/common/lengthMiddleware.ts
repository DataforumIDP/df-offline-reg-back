import { body } from "express-validator";

export function lengthValidation(key: string, { min = 0, max = 255 }) {
    return body(key)
        .isLength({ min, max })
        .withMessage(`Поле ${key} ${min}-${max} символов`);
}
