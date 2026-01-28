/**
 * Модель Webhook
 */

export interface Webhook {
    id: number;
    project_id: number;
    slug: string;
    name: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface WebhookLog {
    id: number;
    webhook_id: number;
    request_body: Record<string, any> | null;
    request_headers: Record<string, any> | null;
    response_status: number | null;
    response_body: Record<string, any> | null;
    error_message: string | null;
    ip_address: string | null;
    created_at: Date;
}

export interface CreateWebhookDTO {
    projectId: number;
    name: string;
    slug?: string; // Опциональный slug, если не передан - генерируется автоматически
    isActive?: boolean;
}

export interface UpdateWebhookDTO {
    name?: string;
    isActive?: boolean;
}

export interface CreateWebhookLogDTO {
    webhookId: number;
    requestBody?: Record<string, any> | null;
    requestHeaders?: Record<string, any> | null;
    responseStatus?: number | null;
    responseBody?: Record<string, any> | null;
    errorMessage?: string | null;
    ipAddress?: string | null;
}

/**
 * Helper для преобразования данных webhook
 */
export const WebhookHelper = {
    toJSON(webhook: Webhook) {
        return {
            id: webhook.id,
            projectId: webhook.project_id,
            slug: webhook.slug,
            name: webhook.name,
            isActive: webhook.is_active,
            createdAt: webhook.created_at,
            updatedAt: webhook.updated_at,
        };
    },

    toLogJSON(log: WebhookLog) {
        return {
            id: log.id,
            webhookId: log.webhook_id,
            requestBody: log.request_body,
            requestHeaders: log.request_headers,
            responseStatus: log.response_status,
            responseBody: log.response_body,
            errorMessage: log.error_message,
            ipAddress: log.ip_address,
            createdAt: log.created_at,
        };
    },
};
