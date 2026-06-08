export interface EmailAccount {
    id: number;
    slug: string;
    host: string;
    port: number;
    secure: boolean;
    login: string;
    password: string;
    from_name: string | null;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface EmailAccountJSON {
    id: number;
    slug: string;
    host: string;
    port: number;
    secure: boolean;
    login: string;
    fromName: string | null;
    createdAt: string;
    updatedAt: string;
}

export class EmailAccountHelper {
    /** Никогда не включаем password в ответ API */
    static toJSON(account: EmailAccount): EmailAccountJSON {
        return {
            id: account.id,
            slug: account.slug,
            host: account.host,
            port: account.port,
            secure: account.secure,
            login: account.login,
            fromName: account.from_name ?? null,
            createdAt: account.created_at.toISOString(),
            updatedAt: account.updated_at.toISOString(),
        };
    }
}
