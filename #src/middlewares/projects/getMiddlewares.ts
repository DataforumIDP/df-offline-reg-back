import { authenticateJWT } from "../common/authMiddleware";
import { roleCheck } from "../common/roleCaheck";
import { adminRoles } from "../../datas/rolesData";

export const getMiddlewares = [
    authenticateJWT(true),
    roleCheck(adminRoles),
];
