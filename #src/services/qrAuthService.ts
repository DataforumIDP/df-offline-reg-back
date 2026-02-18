import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { generateRandomString } from "../utils/generateRandomString";
import { AccountsDAL } from "../dal/accountsDAL";
import { sessionsDAL } from "../dal/sessionsDAL";
import { AccountHelper } from "../models/accounts";
import { SessionHelper } from "../models/sessions";
import { JWT } from "../utils/JWTutils";

const AccountDAL = new AccountsDAL();

interface PendingAuth {
    socketId: string;
    code: string;
    createdAt: Date;
    ipAddress: string;
    userAgent: string;
}

// Хранилище ожидающих авторизации по коду
const pendingAuths = new Map<string, PendingAuth>();

// Время жизни кода - 5 минут
const CODE_TTL_MS = 5 * 60 * 1000;

let io: SocketIOServer | null = null;

/**
 * Инициализация Socket.IO сервера для QR авторизации
 */
export function initQrAuthSocket(server: HttpServer): SocketIOServer {
    io = new SocketIOServer(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        path: "/socket.io",
    });

    const qrAuthNamespace = io.of("/qr-auth");

    qrAuthNamespace.on("connection", (socket: Socket) => {
        console.log(`[QR Auth] Client connected: ${socket.id}`);

        // Клиент запрашивает код
        socket.on("request-code", () => {
            // Генерируем уникальный код
            let code: string;
            do {
                code = generateRandomString(8).toUpperCase();
            } while (pendingAuths.has(code));

            const ipAddress = socket.handshake.headers["x-forwarded-for"] as string 
                || socket.handshake.address 
                || "unknown";
            const userAgent = socket.handshake.headers["user-agent"] || "";

            // Регистрируем соединение
            pendingAuths.set(code, {
                socketId: socket.id,
                code,
                createdAt: new Date(),
                ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
                userAgent,
            });

            console.log(`[QR Auth] Code generated: ${code} for socket: ${socket.id}`);

            socket.emit("code-generated", {
                code,
                ttl: Math.floor(CODE_TTL_MS / 1000),
            });
        });

        socket.on("disconnect", () => {
            // Удаляем все коды связанные с этим сокетом
            for (const [code, auth] of pendingAuths.entries()) {
                if (auth.socketId === socket.id) {
                    pendingAuths.delete(code);
                    console.log(`[QR Auth] Code ${code} removed (socket disconnected)`);
                }
            }
        });
    });

    // Очистка просроченных кодов каждую минуту
    setInterval(() => {
        const now = Date.now();
        for (const [code, auth] of pendingAuths.entries()) {
            if (now - auth.createdAt.getTime() > CODE_TTL_MS) {
                // Уведомляем клиента что код истёк
                const qrAuthNs = io?.of("/qr-auth");
                qrAuthNs?.to(auth.socketId).emit("code-expired");
                pendingAuths.delete(code);
                console.log(`[QR Auth] Code ${code} expired`);
            }
        }
    }, 60 * 1000);

    console.log("[QR Auth] Socket.IO server initialized on /qr-auth namespace");

    return io;
}

/**
 * Подтверждение QR авторизации (вызывается когда админ сканирует QR)
 */
export async function confirmQrAuth(
    code: string,
    adminAccountId: number
): Promise<{ success: boolean; error?: string }> {
    const pending = pendingAuths.get(code);

    if (!pending) {
        return { success: false, error: "Код не найден или истёк" };
    }

    // Получаем аккаунт админа
    const account = await AccountDAL.findByPk(adminAccountId);
    if (!account) {
        return { success: false, error: "Аккаунт не найден" };
    }

    // Генерируем токены
    const payload = AccountHelper.toJSON(account);
    const accessToken = JWT.createAccessToken(payload);
    const refreshToken = JWT.createRefreshToken(payload);

    // Создаем сессию
    const tokenHash = SessionHelper.hashToken(refreshToken);
    const deviceName = SessionHelper.parseDeviceName(pending.userAgent);
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    await sessionsDAL.create({
        account_id: account.id,
        token_hash: tokenHash,
        ip_address: pending.ipAddress,
        user_agent: pending.userAgent,
        device_name: deviceName,
        expires_at: expiresAt,
    });

    // Отправляем токены через Socket.IO
    const qrAuthNs = io?.of("/qr-auth");
    qrAuthNs?.to(pending.socketId).emit("authenticated", {
        message: "Авторизация успешна",
        accessToken,
        refreshToken,
        account: payload,
    });

    pendingAuths.delete(code);

    return { success: true };
}

/**
 * Проверка существования кода
 */
export function isCodePending(code: string): boolean {
    return pendingAuths.has(code);
}
