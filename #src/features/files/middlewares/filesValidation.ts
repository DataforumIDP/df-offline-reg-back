import { Request, Response, NextFunction } from "express";
import { UploadedFile } from "express-fileupload";
import { errorSend } from "../../../utils/errors";
import { isNotArray } from "../../../utils/isNoArray";

const acceptFileTypes = [
    "jpg",
    "jpeg",
    "pptx",
    "ppt",
    "docx",
    "doc",
    "odt",
    "odp",
    "pdf",
    "png",
];

export async function filesValidation(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const { files } = req;

    if (!files || Object.keys(files).length === 0)
        return errorSend(res, { file: "Необходимо загрузить файл!" });

    const singleFiles = Object.values(files).filter(isNotArray);

    if (typeNoAccept(singleFiles))
        return errorSend(res, {
            file: "Вы загружаете файл не разрешенного типа!",
        });

    if (fileTooBig(singleFiles))
        return errorSend(res, { file: "Вы загружаете слишком большой файл!" });

    return next();
}

function typeNoAccept(files: UploadedFile[]) {
    return files.find((file: UploadedFile) => {
        const fileType = file.name.split(".").pop() ?? "";
        return acceptFileTypes.indexOf(fileType) == -1 ? true : false;
    });
}

function fileTooBig(files: UploadedFile[]) {
    return files.find((file: UploadedFile) => {
        const fileSize = file.size;
        const sizeLimt = 1024 * 1024 * 1024 * 0.5;
        return fileSize > sizeLimt ? true : false;
    });
}
