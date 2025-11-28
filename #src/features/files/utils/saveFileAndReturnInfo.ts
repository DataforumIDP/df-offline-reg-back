import { UploadedFile } from "express-fileupload";
import dotenv from "dotenv";
import { generateRandomString } from "../../../utils/generateRandomString";
import { wrap } from "../../../utils/wrap";
import { FilesDAL as fDAL } from "../dal/filesDAL";
import { uploadToS3 } from "./s3/uploadToS3";
import Files from "../models/files";
import { compressImage } from "./compressImage";

dotenv.config();

const FilesDAL = new fDAL();

const { SELECTEL_S3_BUCKET } = process.env;

if (!SELECTEL_S3_BUCKET) {
    throw new Error("S3 bucket name is not set in environment variables");
}

export async function saveFileAndReturnInfo(
    file: UploadedFile | Buffer,
    fileName?: string, // Имя файла, если передается Buffer
    // MIME-тип, если передается Buffer
    ): Promise<Files> {
        let fileData: UploadedFile | Buffer = file;
        let type: string;
        let originalName: string;

        if (file instanceof Buffer) {
            if (!fileName) {
                throw "fileName и mimeType обязательны при передаче Buffer";
            }
            fileData = file;
            type = fileName.split(".").at(-1) || "";
            originalName = fileName;
        } else if ("name" in file && "mimetype" in file) {
            type = file.name.split(".").at(-1) || "";
            originalName = file.name;

            console.log("Тип файла", file.mimetype);
            

            // Если это изображение, сжимаем его
            if (["image/png", "image/jpeg", "image/jpg"].includes(file.mimetype)) {
                fileData = await compressImage(file);
            } else {
                fileData = file.data
            }
        } else {
            throw "Передан некорректный тип файла";
        }

        const genName = generateRandomString(35) + "." + type;

        const params = {
            Bucket: SELECTEL_S3_BUCKET,
            Key: `/${genName}`,
            Body: fileData,
        };

        const [, s3Err] = await wrap(uploadToS3(params as any));

        if (s3Err) {
            throw `Ошибка загрузки в S3: ${s3Err}`;
        }

        const [dbFileResult, dbErr] = await wrap(
            FilesDAL.create({ url: genName, name: originalName, type: type })
        );

        if (dbErr || dbFileResult === null) {
            throw "Ошибка создания файла в базе данных";
        }

        return dbFileResult;
    }
