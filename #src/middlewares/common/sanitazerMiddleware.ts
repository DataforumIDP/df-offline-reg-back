import { Request, Response, NextFunction } from "express";
import { filteredObjectByKeys } from "../../utils/filteredObjectByKeys";
import { response204 } from "../../utils/responses";
export function sanitazerMiddleware(dict: string[], key: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const data = filteredObjectByKeys(req[key], dict);
        if (!Object.keys(data).length) return response204(res)
        req[key] = data
        return next();
    };
}
