import { Request, Response, NextFunction } from "express";
import { wrap } from "../utils/wrap";
import { error404 } from "../utils/errors";
import { BaseDAL } from "../dal/_baseDAL";

export function existsEntity(props: {
    tableName: string;
    resultCheckStatus?: boolean;
    objKey?: string;
    reqKey?: string;
    entityKey: string;
}) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const {
            tableName,
            resultCheckStatus = true,
            objKey = "id",
            reqKey = "params",
            entityKey,
        } = props;

        const id = req[reqKey][objKey];

        const [result] = await wrap(new BaseDAL(tableName).findOne({ id }), true);

        if (!result === resultCheckStatus) return error404(res);

        if (resultCheckStatus) req[entityKey] = result;

        next();
    };
}
