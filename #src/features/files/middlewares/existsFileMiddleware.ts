import { NextFunction, Response } from "express";
import { dbError, error404 } from "../../../utils/errors";
import { wrap } from "../../../utils/wrap";
import { ReqWithParams } from "../../../baseTypes";
import { FilesDAL as fDAL } from "../dal/filesDAL";
const FilesDAL = new fDAL();

export async function existsFileMiddleware(
    req: ReqWithParams<{ file: string }>,
    res: Response,
    next: NextFunction
) {
    const { file } = req.params;
    const [fileData, err] = await wrap(FilesDAL.findOne({ url: file }));

    if (err) return dbError(res, "#GETFILE1");

    if (!fileData) return error404(res);

    req.file = fileData;
    next();
}
