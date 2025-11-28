import { Request, Response, NextFunction } from "express";
export function setAppValueMiddleware(key: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        req.app.set(key, req[key]);
        next();
    };
}
