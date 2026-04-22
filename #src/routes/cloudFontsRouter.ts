import { Router } from "express";
import { cloudFontsService } from "../services/cloudFontsService";
import {
    getCloudFontsMiddlewares,
    createCloudFontMiddlewares,
    deleteCloudFontMiddlewares,
} from "../middlewares/cloudFontsMiddlewares";

export const cloudFontsRouter = Router();

// GET /cloud-fonts
cloudFontsRouter.get("/", getCloudFontsMiddlewares, cloudFontsService.getAll);

// POST /cloud-fonts
cloudFontsRouter.post("/", createCloudFontMiddlewares, cloudFontsService.create);

// DELETE /cloud-fonts/:id
cloudFontsRouter.delete("/:id", deleteCloudFontMiddlewares, cloudFontsService.delete);
