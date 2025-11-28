import { Response } from "express";


export function response201(res: Response, json: any) {
    return res.status(201).json(json)
}
export function response204(res: Response) {
    return res.status(204).json()
}