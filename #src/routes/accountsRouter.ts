import { Router } from "express";
import { AccountService } from "../services/accountService";
import { authMiddlewares } from "../middlewares/accounts/authMiddlewares";
import { authenticateJWT } from "../middlewares/common/authMiddleware";
import { createMiddlewares } from "../middlewares/accounts/createMiddlewares";
import { adminRoles, allRoles } from "../datas/rolesData";
import { updateMiddlewares } from "../middlewares/accounts/updateMiddlewares";
import { deleteMiddlewares } from "../middlewares/accounts/deleteMiddlewares";
import { refreshMiddlewares } from "../middlewares/accounts/refreshMiddlewares";
import { registerMiddlewares } from "../middlewares/accounts/registerMiddlewares";

export const accountsRouter = Router();

const account = new AccountService();

//FIXME: не актуально 
accountsRouter.post("/", createMiddlewares, account.crete);
accountsRouter.post("/reg", registerMiddlewares, account.register);

// accountsRouter.post(
//     "/auth/operator",
//     authMiddlewares,
//     account.authbr(allRoles)
// );

accountsRouter.post("/auth/admin", authMiddlewares, account.authbr(adminRoles, true));
accountsRouter.post("/auth/refresh", refreshMiddlewares, account.refreshToken);

accountsRouter.get("/self", authenticateJWT(true), account.self);
//FIXME: не работает
accountsRouter.get("/", [authenticateJWT(true)], account.get);
accountsRouter.get("/:id", [authenticateJWT(true)], account.getOne);
accountsRouter.patch("/:id", updateMiddlewares, account.update);
accountsRouter.delete("/", deleteMiddlewares, account.delete);
