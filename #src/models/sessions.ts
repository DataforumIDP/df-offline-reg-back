import * as crypto from 'crypto';
import { parseUserAgent } from '../utils/parseUserAgent';

export interface Session {
    id: number;
    account_id: number;
    token_hash: string;
    ip_address: string | null;
    user_agent: string | null;
    device_name: string | null;
    device_id: string | null;
    is_active: boolean;
    last_activity: Date;
    expires_at: Date;
    created_at: Date;
    updated_at: Date;
}

export interface SessionJSON {
    id: number;
    accountId: number;
    ipAddress: string | null;
    deviceName: string | null;
    lastActivity: string;
    createdAt: string;
    isCurrent?: boolean;
}

export class SessionHelper {
    /**
     * Преобразует сессию в JSON для отправки клиенту
     */
    static toJSON(session: Session, currentTokenHash?: string): SessionJSON {
        return {
            id: session.id,
            accountId: session.account_id,
            ipAddress: session.ip_address,
            deviceName: session.device_name,
            lastActivity: session.last_activity.toISOString(),
            createdAt: session.created_at.toISOString(),
            isCurrent: currentTokenHash ? session.token_hash === currentTokenHash : undefined,
        };
    }

    /**
     * Создаёт хеш токена для хранения в БД
     */
    static hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Парсит User-Agent и возвращает краткое описание устройства
     */
    static parseDeviceName(userAgent: string | undefined): string | null {
        if (!userAgent) return null;

        const { browser, os, deviceModel } = parseUserAgent(userAgent);

        const parts: string[] = [];

        if (browser) {
            parts.push(browser);
        }

        if (os) {
            parts.push(os);
        }

        if (deviceModel) {
            parts.push(deviceModel);
        }

        return parts.length > 0 ? parts.join(' / ') : 'Unknown Device';
    }

    /**
     * Получает IP адрес из запроса
     */
    static getIpAddress(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string | null {
        const forwarded = req.headers?.['x-forwarded-for'];
        if (forwarded) {
            const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
            return ip?.trim() || null;
        }
        return req.ip || null;
    }
}
