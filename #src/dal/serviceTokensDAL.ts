import { db } from "../config/db";

export interface ServiceToken {
    id: number;
    name: string;
    token: string;
    allowed_ips: string[];
    is_revoked: boolean;
    created_at: Date;
    updated_at: Date;
}

class ServiceTokensDAL {
    private table = "service_tokens";

    async findByToken(token: string): Promise<ServiceToken | undefined> {
        return db(this.table)
            .where({ token, is_revoked: false })
            .first();
    }

    async getAll(): Promise<ServiceToken[]> {
        return db(this.table).orderBy("created_at", "desc");
    }

    async create(data: { name: string; token: string; allowed_ips?: string[] }): Promise<ServiceToken> {
        const [result] = await db(this.table)
            .insert({
                name: data.name,
                token: data.token,
                allowed_ips: data.allowed_ips ?? [],
            })
            .returning("*");
        return result;
    }

    async revoke(id: number): Promise<void> {
        await db(this.table)
            .where({ id })
            .update({ is_revoked: true, updated_at: db.fn.now() });
    }
}

export const serviceTokensDAL = new ServiceTokensDAL();
