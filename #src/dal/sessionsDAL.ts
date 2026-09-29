import { BaseDAL } from "./_baseDAL";
import { Session } from "../models/sessions";

export const SESSION_INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

export class SessionsDAL extends BaseDAL {
    constructor() {
        super('sessions');
    }

    /**
     * Создаёт новую сессию
     */
    async create(data: {
        account_id: number;
        token_hash: string;
        ip_address?: string | null;
        user_agent?: string | null;
        device_name?: string | null;
        device_id?: string | null;
        expires_at: Date;
    }): Promise<Session> {
        const [session] = await this.db(this.tableName)
            .insert({
                account_id: data.account_id,
                token_hash: data.token_hash,
                ip_address: data.ip_address || null,
                user_agent: data.user_agent || null,
                device_name: data.device_name || null,
                device_id: data.device_id || null,
                is_active: true,
                expires_at: data.expires_at,
                last_activity: new Date(),
            })
            .returning('*');
        
        return session;
    }

    /**
     * Находит активную сессию по device_id и account_id.
     * Используется для переиспользования сессии при повторном входе с того же устройства.
     */
    async findActiveByDeviceAndAccount(deviceId: string, accountId: number): Promise<Session | null> {
        await this.deactivateInactiveByAccountId(accountId);

        const session = await this.db(this.tableName)
            .where({ device_id: deviceId, account_id: accountId, is_active: true })
            .where('expires_at', '>', new Date())
            .first();

        return session || null;
    }

    /**
     * Обновляет token_hash и сбрасывает срок действия существующей сессии.
     * Используется при переиспользовании сессии устройства.
     */
    async renewSession(sessionId: number, tokenHash: string, expiresAt: Date): Promise<Session> {
        const [session] = await this.db(this.tableName)
            .where({ id: sessionId })
            .update({
                token_hash: tokenHash,
                expires_at: expiresAt,
                last_activity: new Date(),
                is_active: true,
            })
            .returning('*');

        return session;
    }

    /**
     * Находит активную сессию по хешу токена
     */
    async findByTokenHash(tokenHash: string): Promise<Session | null> {
        const session = await this.db(this.tableName)
            .where({ token_hash: tokenHash, is_active: true })
            .first();

        if (!session) {
            return null;
        }

        if (Date.now() - new Date(session.last_activity).getTime() >= SESSION_INACTIVITY_LIMIT_MS) {
            await this.deactivate(session.id);
            return null;
        }

        if (new Date(session.expires_at) <= new Date()) {
            return null;
        }
        
        return session;
    }

    /**
     * Получает все активные сессии пользователя
     */
    async getActiveByAccountId(accountId: number): Promise<Session[]> {
        await this.deactivateInactiveByAccountId(accountId);

        return this.db(this.tableName)
            .where({ account_id: accountId, is_active: true })
            .where('expires_at', '>', new Date())
            .orderBy('last_activity', 'desc');
    }

    /**
     * Деактивирует сессии аккаунта без активности в течение семи дней
     */
    async deactivateInactiveByAccountId(accountId: number): Promise<number> {
        const inactiveBefore = new Date(Date.now() - SESSION_INACTIVITY_LIMIT_MS);

        return this.db(this.tableName)
            .where({ account_id: accountId, is_active: true })
            .where('last_activity', '<=', inactiveBefore)
            .update({ is_active: false });
    }

    /**
     * Обновляет время последней активности
     */
    async updateLastActivity(sessionId: number): Promise<void> {
        await this.db(this.tableName)
            .where({ id: sessionId })
            .update({ last_activity: new Date() });
    }

    /**
     * Деактивирует сессию (завершает её)
     */
    async deactivate(sessionId: number): Promise<boolean> {
        const updated = await this.db(this.tableName)
            .where({ id: sessionId })
            .update({ is_active: false });
        
        return updated > 0;
    }

    /**
     * Деактивирует сессию по хешу токена
     */
    async deactivateByTokenHash(tokenHash: string): Promise<boolean> {
        const updated = await this.db(this.tableName)
            .where({ token_hash: tokenHash })
            .update({ is_active: false });
        
        return updated > 0;
    }

    /**
     * Деактивирует все сессии пользователя (кроме указанной)
     */
    async deactivateAllByAccountId(accountId: number, exceptSessionId?: number): Promise<number> {
        let query = this.db(this.tableName)
            .where({ account_id: accountId, is_active: true });
        
        if (exceptSessionId) {
            query = query.whereNot({ id: exceptSessionId });
        }
        
        return query.update({ is_active: false });
    }

    /**
     * Проверяет, принадлежит ли сессия аккаунту
     */
    async belongsToAccount(sessionId: number, accountId: number): Promise<boolean> {
        const session = await this.db(this.tableName)
            .where({ id: sessionId, account_id: accountId })
            .first();
        
        return !!session;
    }

    /**
     * Удаляет истёкшие сессии (для cleanup job)
     */
    async deleteExpired(): Promise<number> {
        return this.db(this.tableName)
            .where('expires_at', '<', new Date())
            .orWhere({ is_active: false })
            .delete();
    }
}

export const sessionsDAL = new SessionsDAL();
