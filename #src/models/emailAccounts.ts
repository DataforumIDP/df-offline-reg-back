export type EmailProvider = 'smtp' | 'rusender';

export interface EmailAccount {
    id: number;
    slug: string;
    provider: EmailProvider;
    host: string | null;
    port: number | null;
    secure: boolean | null;
    login: string | null;
    alias: string | null;
    api_key: string | null;
    password: string | null;
    from_name: string | null;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface EmailAccountJSON {
    id: number;
    slug: string;
    provider: EmailProvider;
    host: string | null;
    port: number | null;
    secure: boolean | null;
    login: string | null;
    alias: string | null;
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
            provider: account.provider ?? 'smtp',
            host: account.host ?? null,
            port: account.port ?? null,
            secure: account.secure ?? null,
            login: account.login ?? null,
            alias: account.alias ?? null,
            fromName: account.from_name ?? null,
            createdAt: account.created_at.toISOString(),
            updatedAt: account.updated_at.toISOString(),
        };
    }
}
