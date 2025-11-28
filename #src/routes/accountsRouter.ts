import { Router } from "express";
import { AccountService } from "../services/accountService";
import { authMiddlewares } from "../middlewares/accounts/authMiddlewares";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { createMiddlewares } from "../middlewares/accounts/createMiddlewares";
import { adminRoles, allRoles } from "../datas/rolesData";
import { updateMiddlewares } from "../middlewares/accounts/updateMiddlewares";
import { deleteMiddlewares } from "../middlewares/accounts/deleteMiddlewares";

export const accountsRouter = Router();

const account = new AccountService();

accountsRouter.post("/", createMiddlewares, account.crete);

accountsRouter.post(
    "/auth/operator",
    authMiddlewares,
    account.authbr(allRoles)
);

accountsRouter.post("/auth/admin", authMiddlewares, account.authbr(adminRoles));

accountsRouter.get("/self", authenticateJWT(true), account.self);
accountsRouter.get("/", [authenticateJWT(true)], account.get);
accountsRouter.patch("/:id", updateMiddlewares, account.update);
accountsRouter.delete("/", deleteMiddlewares, account.delete);
