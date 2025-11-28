import { Request, Response } from "express";
import dotenv from "dotenv";
import { saveFileAndReturnInfo } from "../utils/saveFileAndReturnInfo";
import { wrap } from "../../../utils/wrap";
import { error404, errorSend } from "../../../utils/errors";
import { isNotArray } from "../../../utils/isNoArray";
import { getRangeFromS3 } from "../utils/s3/getRangeFromS3";
import { getFromS3 } from "../utils/s3/getFromS3";
import { ReqWithQuery } from "../../../baseTypes";
import { importFromYandex } from "../utils/s3/importFromYandex";

dotenv.config();

const { SELECTEL_S3_BUCKET } = process.env;

export class FileService {
    async get(req: Request, res: Response) {
        const file = (req as any).file!;

        const params = {
            Bucket: SELECTEL_S3_BUCKET!,
            Key: file.url,
        };

        if (req.headers.range) return await getRangeFromS3(req, res, params);

        const [fileFromS3] = await wrap(getFromS3(params));

        if (!fileFromS3 || !(fileFromS3 as any).Body) return error404(res);

        // Убедитесь, что Body является потоком
        const stream = (fileFromS3 as any).Body as NodeJS.ReadableStream;

        // Отправляем поток напрямую в ответ
        stream.pipe(res);
    }

    async upload(req: Request, res: Response) {
        
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const files = Object.values(req.files);
        const uploadResults: any[] = [];
        const CDN_BASE_URL = "https://10b82a3a-34ee-4ace-86a0-2af8648ee2ac.selstorage.ru/";

        // Проверяем количество файлов (максимум 10)
        if (files.length > 10) {
            return res.status(400).json({ error: "Maximum 10 files allowed" });
        }

        for (const file of files) {
            if (Array.isArray(file)) {
                // Если файл является массивом, обрабатываем каждый элемент
                for (const singleFile of file) {
                    const [fileData, err] = await wrap(saveFileAndReturnInfo(singleFile));
                    
                    if (fileData === null) {
                        uploadResults.push({ error: err, filename: singleFile.name });
                    } else {
                        uploadResults.push({
                            ...fileData.toJSON(),
                            cdnUrl: `${CDN_BASE_URL}${fileData.url}`,
                        });
                    }
                }
            } else {
                const [fileData, err] = await wrap(saveFileAndReturnInfo(file));
                
                if (fileData === null) {
                    uploadResults.push({ error: err, filename: file.name });
                } else {
                    uploadResults.push({
                        ...fileData.toJSON(),
                        cdnUrl: `${CDN_BASE_URL}${fileData.url}`,
                    });
                }
            }
        }

        res.status(200).json({
            status: "uploaded",
            files: uploadResults,
        });
    }

    async import(req: ReqWithQuery<{link: string}>, res: Response) {
        const { link } = req.query;

        if (!link) return errorSend(res, {link: "Ссылка не указана!"});

        const [fileData, err] = await wrap(importFromYandex(link));

        if (fileData === null)
            return errorSend(res, {files: err});

        res.status(200).json({
            status: "uploaded",
            files: fileData,
        });
    }
}
