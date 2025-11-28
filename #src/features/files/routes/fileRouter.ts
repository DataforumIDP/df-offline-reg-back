import { Router } from "express";
import fileUpload from "express-fileupload";
import { FileService } from "../services/fileService";
import { uploadMiddleware } from "../middlewares/uploadMiddleware";
import { getFileMiddleware } from "../middlewares/getFileMiddleware";

export const filesRouter = Router();

const file = new FileService();

const fileUploadMiddleware = fileUpload({
    defCharset: "utf-8",
    defParamCharset: "utf-8"
});

filesRouter.use(fileUploadMiddleware as any);

// Загрузка файлов - только для админов
filesRouter.post("/", ...uploadMiddleware, file.upload);
filesRouter.get("/:file", ...getFileMiddleware, file.get);
// filesRouter.get("/export/yandex", authenticateJWT(true), file.import);
