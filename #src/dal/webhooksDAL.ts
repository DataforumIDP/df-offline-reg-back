import { db } from "../config/db";
import { Webhook, WebhookLog, CreateWebhookDTO, UpdateWebhookDTO, CreateWebhookLogDTO } from "../models/webhooks";
import { generateRandomString } from "../utils/generateRandomString";

/**
 * DAL для работы с Webhooks
 */
export class WebhooksDAL {
    private readonly table = "webhooks";
    private readonly logsTable = "webhook_logs";

    /**
     * Создать webhook
     */
    async create(data: CreateWebhookDTO): Promise<Webhook> {
        let slug: string;

        if (data.slug) {
            // Используем переданный slug, проверяем уникальность
            const existing = await db(this.table).where({ slug: data.slug }).first();
            if (existing) {
                throw new Error('SLUG_EXISTS');
            }
            slug = data.slug;
        } else {
            // Генерируем уникальный slug
            let isUnique = false;
            do {
                slug = generateRandomString(16);
                const existing = await db(this.table).where({ slug }).first();
                isUnique = !existing;
            } while (!isUnique);
        }

        const [webhook] = await db(this.table)
            .insert({
                project_id: data.projectId,
                slug,
                name: data.name,
                is_active: data.isActive ?? true,
            })
            .returning("*");

        return webhook;
    }

    /**
     * Получить webhook по ID
     */
    async getById(id: number): Promise<Webhook | null> {
        const webhook = await db(this.table).where({ id }).first();
        return webhook || null;
    }

    /**
     * Получить webhook по slug
     */
    async getBySlug(slug: string): Promise<Webhook | null> {
        const webhook = await db(this.table).where({ slug }).first();
        return webhook || null;
    }

    /**
     * Получить все webhooks проекта
     */
    async getByProjectId(projectId: number): Promise<Webhook[]> {
        return db(this.table)
            .where({ project_id: projectId })
            .orderBy("created_at", "desc");
    }

    /**
     * Обновить webhook
     */
    async update(id: number, data: UpdateWebhookDTO): Promise<Webhook | null> {
        const updateData: Partial<Webhook> = {
            updated_at: new Date(),
        };

        if (data.name !== undefined) {
            updateData.name = data.name;
        }
        if (data.isActive !== undefined) {
            updateData.is_active = data.isActive;
        }
        if (data.preScript !== undefined) {
            (updateData as any).pre_script = data.preScript;
        }
        if (data.postScript !== undefined) {
            (updateData as any).post_script = data.postScript;
        }

        const [updated] = await db(this.table)
            .where({ id })
            .update(updateData)
            .returning("*");

        return updated || null;
    }

    /**
     * Удалить webhook
     */
    async delete(id: number): Promise<boolean> {
        const deleted = await db(this.table).where({ id }).delete();
        return deleted > 0;
    }

    /**
     * Создать запись лога
     */
    async createLog(data: CreateWebhookLogDTO): Promise<WebhookLog> {
        const [log] = await db(this.logsTable)
            .insert({
                webhook_id: data.webhookId,
                request_body: data.requestBody ? JSON.stringify(data.requestBody) : null,
                request_headers: data.requestHeaders ? JSON.stringify(data.requestHeaders) : null,
                response_status: data.responseStatus,
                response_body: data.responseBody ? JSON.stringify(data.responseBody) : null,
                error_message: data.errorMessage,
                ip_address: data.ipAddress,
            })
            .returning("*");

        return log;
    }

    /**
     * Получить логи webhook
     */
    async getLogs(webhookId: number, limit: number = 100): Promise<WebhookLog[]> {
        return db(this.logsTable)
            .where({ webhook_id: webhookId })
            .orderBy("created_at", "desc")
            .limit(limit);
    }
}

export const webhooksDAL = new WebhooksDAL();
