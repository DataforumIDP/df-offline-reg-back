import { Router, Request, Response } from "express";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { roleCheck } from "../middlewares/common/roleCaheck";
import { adminRoles } from "../datas/rolesData";
import { confirmQrAuth, isCodePending } from "../services/qrAuthService";

export const qrAuthRouter = Router();

/**
 * POST /qr-auth/confirm
 * Подтверждает авторизацию по QR коду
 * Требует авторизации админа
 */
qrAuthRouter.post(
    "/confirm",
    authenticateJWT(),
    roleCheck(adminRoles),
    async (req: Request, res: Response) => {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ error: "Код обязателен" });
        }

        if (!isCodePending(code)) {
            return res.status(404).json({ error: "Код не найден или истёк" });
        }

        const result = await confirmQrAuth(code, req.account!.id);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({ message: "Авторизация подтверждена" });
    }
);
