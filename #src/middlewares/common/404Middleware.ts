import { Request, Response, NextFunction } from 'express';
export async function _404Middleware (req: Request, res: Response, next: NextFunction){
    res.status(404).json({
        error: "API`s not found",
    });
}