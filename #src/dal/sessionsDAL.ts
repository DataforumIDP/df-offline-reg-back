import { BaseDAL } from "./_baseDAL";
import { Session } from "../models/sessions";

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
        expires_at: Date;
    }): Promise<Session> {
        const [session] = await this.db(this.tableName)
            .insert({
                account_id: data.account_id,
                token_hash: data.token_hash,
                ip_address: data.ip_address || null,
                user_agent: data.user_agent || null,
                device_name: data.device_name || null,
                is_active: true,
                expires_at: data.expires_at,
                last_activity: new Date(),
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
            .where('expires_at', '>', new Date())
            .first();
        
        return session || null;
    }

    /**
     * Получает все активные сессии пользователя
     */
    async getActiveByAccountId(accountId: number): Promise<Session[]> {
        return this.db(this.tableName)
            .where({ account_id: accountId, is_active: true })
            .where('expires_at', '>', new Date())
            .orderBy('last_activity', 'desc');
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
