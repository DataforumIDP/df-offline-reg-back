import { Response } from "express";

export function authError(
    res: Response,
    text: string = "Требуется авторизация!"
) {
    errorSend(res, { authorize: text }, { code: 401 });
}

export function dbError(res: Response, slag: string = "#777!") {
    errorSend(res, { db: `Ошибка базы данных ${slag}` }, { code: 500 });
}

export function errorSend(
    res: Response,
    data: any,
    options: { code: number } = { code: 400 }
) {
    res.status(options.code).json({ errors: data });
}

export function error404(res: Response, text: string = "Запись не найдена") {
    errorSend(res, { text }, { code: 404 });
}
