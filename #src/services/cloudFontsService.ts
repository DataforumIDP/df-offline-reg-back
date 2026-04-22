import { Request, Response, NextFunction } from "express";
import { cloudFontsDAL } from "../dal/cloudFontsDAL";
import { CloudFontHelper } from "../models/cloudFonts";
import { wrap } from "../utils/wrap";
import { dbError, error404, errorSend } from "../utils/errors";
import { response201, response204 } from "../utils/responses";

const URL_PATTERN = /^https?:\/\/.+/;

function isValidUrl(url: string): boolean {
    return URL_PATTERN.test(url);
}

class CloudFontsService {
    /**
     * GET /cloud-fonts
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const fonts = await cloudFontsDAL.getAll();
            res.json({ fonts: fonts.map(CloudFontHelper.toJSON) });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /cloud-fonts
     * Body: { name, normalUrl, boldUrl, italicUrl, bolditalicUrl }
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { name, normalUrl, boldUrl, italicUrl, bolditalicUrl } = req.body;

            const validationErrors: Record<string, string> = {};
            if (!name?.trim()) {
                validationErrors.name = "Название шрифта обязательно";
            }
            const urlFields: Record<string, string> = {
                normalUrl,
                boldUrl,
                italicUrl,
                bolditalicUrl,
            };
            for (const [field, url] of Object.entries(urlFields)) {
                if (!url || !isValidUrl(url)) {
                    validationErrors[field] = "Некорректная ссылка на файл шрифта";
                }
            }
            if (Object.keys(validationErrors).length > 0) {
                return errorSend(res, validationErrors);
            }

            const [font, err] = await wrap(
                cloudFontsDAL.create({
                    name: name.trim(),
                    normal_url: normalUrl,
                    bold_url: boldUrl,
                    italic_url: italicUrl,
                    bolditalic_url: bolditalicUrl,
                })
            );

            if (err || !font) {
                return dbError(res, "#CREATECLOUDFONT1");
            }

            response201(res, CloudFontHelper.toJSON(font));
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /cloud-fonts/:id
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const font = await cloudFontsDAL.getById(id);

            if (!font) {
                return error404(res, "Шрифт не найден");
            }

            await cloudFontsDAL.softDelete(id);
            response204(res);
        } catch (error) {
            next(error);
        }
    }
}

export const cloudFontsService = new CloudFontsService();
