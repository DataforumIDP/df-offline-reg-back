import { Router } from "express";
import { emailAccountsService } from "../services/emailAccountsService";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { roleCheck } from "../middlewares/common/roleCaheck";
import { adminRoles } from "../datas/rolesData";

export const emailAccountsRouter = Router();

const auth = [authenticateJWT(), roleCheck(adminRoles)];

// GET /email-accounts
emailAccountsRouter.get("/", ...auth, emailAccountsService.getAll.bind(emailAccountsService));

// POST /email-accounts
emailAccountsRouter.post("/", ...auth, emailAccountsService.create.bind(emailAccountsService));

// PUT /email-accounts/:id
emailAccountsRouter.put("/:id", ...auth, emailAccountsService.update.bind(emailAccountsService));

// DELETE /email-accounts/:id
emailAccountsRouter.delete("/:id", ...auth, emailAccountsService.delete.bind(emailAccountsService));
