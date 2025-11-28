import { body } from "express-validator";
import { filesValidation } from "./filesValidation";
import { authenticateJWT } from "../../../middlewares/common/authMiddleware";

export const uploadFilesMiddlewares = [
    authenticateJWT(true),
    filesValidation,
]