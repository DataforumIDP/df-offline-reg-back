import { BaseDAL } from "./_baseDAL";
import { EmailAccount } from "../models/emailAccounts";

export interface CreateEmailAccountData {
    slug: string;
    host: string;
    port: number;
    secure: boolean;
    login: string;
    password: string;
    from_name?: string | null;
}

export interface UpdateEmailAccountData {
    slug?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    login?: string;
    password?: string;
    from_name?: string | null;
}

export class EmailAccountsDAL extends BaseDAL {
    constructor() {
        super("email_accounts");
    }

    async getAll(): Promise<EmailAccount[]> {
        return this.db<EmailAccount>(this.tableName)
            .where({ is_delete: false })
            .orderBy("created_at", "ASC");
    }

    async getById(id: number): Promise<EmailAccount | null> {
        const result = await this.db<EmailAccount>(this.tableName)
            .where({ id, is_delete: false })
            .first();
        return result ?? null;
    }

    async getBySlug(slug: string): Promise<EmailAccount | null> {
        const result = await this.db<EmailAccount>(this.tableName)
            .where({ slug, is_delete: false })
            .first();
        return result ?? null;
    }

    async create(data: CreateEmailAccountData): Promise<EmailAccount> {
        const [account] = await this.db<EmailAccount>(this.tableName)
            .insert(data)
            .returning("*");
        return account;
    }

    async update(id: number, data: UpdateEmailAccountData): Promise<EmailAccount | null> {
        const [account] = await this.db<EmailAccount>(this.tableName)
            .where({ id, is_delete: false })
            .update({ ...data, updated_at: this.db.fn.now() })
            .returning("*");
        return account ?? null;
    }

    async softDelete(id: number): Promise<void> {
        await this.db<EmailAccount>(this.tableName)
            .where({ id })
            .update({ is_delete: true, updated_at: this.db.fn.now() });
    }

    async isSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
        const query = this.db<EmailAccount>(this.tableName)
            .where({ slug, is_delete: false });
        if (excludeId !== undefined) {
            query.whereNot({ id: excludeId });
        }
        const result = await query.first();
        return !!result;
    }
}

export const emailAccountsDAL = new EmailAccountsDAL();
