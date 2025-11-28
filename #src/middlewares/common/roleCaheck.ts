import { Request, Response, NextFunction } from "express";
import { authError } from "../../utils/errors";
export function roleCheck(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const account = req.account!;
        return roles.includes(account.role) ? next() : authError(res, "Недостаточно прав!");
    };
}
