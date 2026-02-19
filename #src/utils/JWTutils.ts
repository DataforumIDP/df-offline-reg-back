import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export class JWT {

    static secret = (process.env.JWT_ACCESS_SECRET as string) || "12345";
    static refreshSecret = (process.env.JWT_REFRESH_SECRET as string) || "refresh_secret_12345";

    static createAccessToken(payload: any, options?: { sessionId?: number }) {
        return jwt.sign(
            { 
                payload,
                sessionId: options?.sessionId,
                jti: Date.now() + Math.random() // Добавляем уникальный идентификатор токена
            },
            this.secret,
            { expiresIn: "15m" } // Access токен действителен 15 минут
        );
    }

    static createRefreshToken(payload: any, options?: { sessionId?: number }) {
        return jwt.sign(
            {
                payload,
                sessionId: options?.sessionId,
            },
            this.refreshSecret,
            { expiresIn: "60d" } // Refresh токен действителен 60 дней
        );
    }

    static verifyAccessToken(token: string) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, this.secret, (err, decoded) => {
                if (err) reject(err)
                    else resolve(decoded)
            });
        });
    }

    static verifyRefreshToken(token: string) {
        return new Promise((resolve, reject) => {
            jwt.verify(token, this.refreshSecret, (err, decoded) => {
                if (err) reject(err)
                    else resolve(decoded)
            });
        });
    }

    // Оставляем старые методы для обратной совместимости
    static create(payload: any) {
        return this.createAccessToken(payload);
    }

    static verify(token: string) {
        return this.verifyAccessToken(token);
    }
}
