import { Server as SocketIOServer, Socket } from "socket.io";
import { AccountsDAL } from "../dal/accountsDAL";
import { sessionsDAL, SESSION_INACTIVITY_LIMIT_MS } from "../dal/sessionsDAL";
import { JWT } from "../utils/JWTutils";
import { db } from "../config/db";

const accountsDAL = new AccountsDAL();
const ADMIN_ROLES = new Set(["admin", "superadmin"]);
const OPERATOR_ROOM_PREFIX = "event:";

type OperatorCommand = "clear-cache" | "logout";

interface AccessTokenPayload {
    payload?: { id?: number };
    sessionId?: number;
}

interface OperatorSocketData {
    token: string;
    accountId: number;
    role: string;
    projectId: number | null;
}

async function authenticateToken(token: string): Promise<OperatorSocketData> {
    const decoded = (await JWT.verifyAccessToken(token)) as AccessTokenPayload;
    const accountId = Number(decoded.payload?.id);
    if (!Number.isInteger(accountId) || accountId <= 0) {
        throw new Error("Invalid token payload");
    }

    const account = await accountsDAL.findByPk(accountId);
    if (!account || account.is_delete) {
        throw new Error("Account is unavailable");
    }

    if (ADMIN_ROLES.has(account.role)) {
        const sessionId = Number(decoded.sessionId);
        if (!sessionId) {
            throw new Error("Admin session is missing");
        }

        const session = await sessionsDAL.findByPk(sessionId);
        if (
            !session ||
            !session.is_active ||
            session.account_id !== account.id ||
            new Date(session.expires_at) <= new Date()
        ) {
            throw new Error("Admin session is inactive");
        }

        if (
            Date.now() - new Date(session.last_activity).getTime() >=
            SESSION_INACTIVITY_LIMIT_MS
        ) {
            await sessionsDAL.deactivate(session.id);
            throw new Error("Admin session expired");
        }

        await sessionsDAL.updateLastActivity(session.id);
    }

    return {
        token,
        accountId: account.id,
        role: account.role,
        projectId: account.projectId ? Number(account.projectId) : null,
    };
}

function acknowledge(
    callback: unknown,
    result: { success: boolean; error?: string; affected?: number }
) {
    if (typeof callback === "function") {
        (callback as (value: typeof result) => void)(result);
    }
}

export function initOperatorControlSocket(io: SocketIOServer): void {
    const operatorControl = io.of("/operator-control");

    operatorControl.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string" || !token) {
            next(new Error("Authentication required"));
            return;
        }

        try {
            socket.data.operatorControl = await authenticateToken(token);
            next();
        } catch {
            next(new Error("Invalid or expired token"));
        }
    });

    operatorControl.on("connection", (socket: Socket) => {
        const auth = socket.data.operatorControl as OperatorSocketData;
        if (auth.role === "operator" && auth.projectId) {
            void socket.join(`${OPERATOR_ROOM_PREFIX}${auth.projectId}`);
        }

        socket.on(
            "admin:command",
            async (
                payload: { projectId?: unknown; command?: unknown },
                callback: unknown
            ) => {
                try {
                    if (!ADMIN_ROLES.has(auth.role)) {
                        acknowledge(callback, {
                            success: false,
                            error: "Недостаточно прав",
                        });
                        return;
                    }

                    let verifiedAuth: OperatorSocketData;
                    try {
                        verifiedAuth = await authenticateToken(auth.token);
                    } catch {
                        acknowledge(callback, {
                            success: false,
                            error: "Сессия администратора завершена",
                        });
                        socket.disconnect(true);
                        return;
                    }
                    if (!ADMIN_ROLES.has(verifiedAuth.role)) {
                        acknowledge(callback, {
                            success: false,
                            error: "Недостаточно прав",
                        });
                        socket.disconnect(true);
                        return;
                    }

                    const projectId = Number(payload?.projectId);
                    const command = payload?.command as OperatorCommand;
                    if (
                        !Number.isInteger(projectId) ||
                        projectId <= 0 ||
                        (command !== "clear-cache" && command !== "logout")
                    ) {
                        acknowledge(callback, {
                            success: false,
                            error: "Некорректная команда",
                        });
                        return;
                    }

                    const projectExists = await db("projects")
                        .where({ id: projectId })
                        .first("id");
                    if (!projectExists) {
                        acknowledge(callback, {
                            success: false,
                            error: "Мероприятие не найдено",
                        });
                        return;
                    }

                    const room = `${OPERATOR_ROOM_PREFIX}${projectId}`;
                    const sockets = await operatorControl.in(room).fetchSockets();
                    operatorControl.to(room).emit(`operator:${command}`);
                    acknowledge(callback, {
                        success: true,
                        affected: sockets.length,
                    });

                    console.log(
                        `[Operator Control] ${command} for project ${projectId} by admin ${verifiedAuth.accountId}; operators=${sockets.length}`
                    );
                } catch (error) {
                    console.error("[Operator Control] Command failed", error);
                    acknowledge(callback, {
                        success: false,
                        error: "Не удалось выполнить команду операторам",
                    });
                }
            }
        );
    });

    console.log("[Operator Control] Socket.IO namespace initialized");
}
