import {
    HeadObjectCommand,
    GetObjectCommand,
    HeadObjectCommandInput,
    GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { Request, Response } from "express";
import { s3 } from "../../config/s3";
import { errorSend } from "../../../../utils/errors";

export async function getRangeFromS3(
    req: Request,
    res: Response,
    params: HeadObjectCommandInput
) {
    const headCommand = new HeadObjectCommand(params);
    try {
        const headData = await s3.send(headCommand);

        if (!headData) return errorSend(res, { file: "Ошибка AWS" });

        const fileSize = headData.ContentLength ?? 0;
        const contentType = headData.ContentType || "video/mp4";
        const range = req.headers.range ?? "";
        const bytesPrefix = "bytes=";
        const parts = range.replace(bytesPrefix, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;

        const getParams: GetObjectCommandInput = {
            ...params,
            Range: `bytes=${start}-${end}`,
        };

        const getCommand = new GetObjectCommand(getParams);
        const response = await s3.send(getCommand);

        const stream = response.Body as NodeJS.ReadableStream;

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": contentType,
        });

        stream.pipe(res);
    } catch (err) {
        errorSend(res, { file: "Ошибка AWS" });
    }
}
