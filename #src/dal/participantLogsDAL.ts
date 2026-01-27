import { BaseDAL } from "./_baseDAL";
import { ParticipantLog, ParticipantLogWithUser, LogAction, LogActor, LogStats } from "../models/participantLogs";

export interface LogsQuery {
    page?: string;
    limit?: string;
    search?: string;
    action?: LogAction;
    actor?: LogActor;
    participantId?: string;
    userId?: string;
    dateStart?: string;
    dateEnd?: string;
}

export interface CreateLogData {
    projectId: number;
    participantId: number | null;
    action: LogAction;
    actor: LogActor;
    userId: number | null;
    currentData: Record<string, any>;
}

export class ParticipantLogsDAL extends BaseDAL {
    constructor() {
        super("participant_logs");
    }

    /**
     * Создать запись в логе
     */
    async create(data: CreateLogData): Promise<ParticipantLog> {
        const [log] = await this.db<ParticipantLog>(this.tableName)
            .insert({
                project_id: data.projectId,
                participant_id: data.participantId,
                action: data.action,
                actor: data.actor,
                user_id: data.userId,
                current_data: data.currentData as any,
            })
            .returning("*");
        return log;
    }

    /**
     * Получить статистику по действиям
     */
    async getStats(projectId: number): Promise<LogStats> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId })
            .select("action")
            .count("id as count")
            .groupBy("action");

        const stats: LogStats = {
            CREATE: 0,
            UPDATE: 0,
            DELETE: 0,
            PRINT: 0,
        };

        for (const row of result) {
            const action = row.action as LogAction;
            stats[action] = Number((row as any).count);
        }

        return stats;
    }

    /**
     * Получить логи с пагинацией и фильтрами
     */
    async getByProjectId(
        projectId: number,
        query: LogsQuery
    ): Promise<[ParticipantLogWithUser[], { total: number }]> {
        const page = Math.max(1, parseInt(query.page || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
        const offset = (page - 1) * limit;

        // Базовый запрос с JOIN на accounts
        let baseQuery = this.db<ParticipantLog>(this.tableName)
            .where({ [`${this.tableName}.project_id`]: projectId })
            .leftJoin("accounts", `${this.tableName}.user_id`, "accounts.id")
            .select(
                `${this.tableName}.*`,
                "accounts.login as user_login",
                "accounts.name as user_name"
            );

        // Фильтр по action
        if (query.action) {
            baseQuery = baseQuery.where({ [`${this.tableName}.action`]: query.action });
        }

        // Фильтр по actor
        if (query.actor) {
            baseQuery = baseQuery.where({ [`${this.tableName}.actor`]: query.actor });
        }

        // Фильтр по участнику
        if (query.participantId) {
            baseQuery = baseQuery.where({ participant_id: parseInt(query.participantId, 10) });
        }

        // Фильтр по пользователю
        if (query.userId) {
            baseQuery = baseQuery.where({ [`${this.tableName}.user_id`]: parseInt(query.userId, 10) });
        }

        // Фильтр по датам
        if (query.dateStart) {
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, ">=", new Date(query.dateStart));
        }
        if (query.dateEnd) {
            const endDate = new Date(query.dateEnd);
            endDate.setHours(23, 59, 59, 999);
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, "<=", endDate);
        }

        // Поиск по данным (ILIKE по JSON)
        if (query.search && query.search.trim()) {
            baseQuery = baseQuery.where(function() {
                this.whereRaw(`${ParticipantLogsDAL.name.replace('DAL', '').toLowerCase()}_logs.current_data::text ILIKE ?`, [`%${query.search}%`])
                    .orWhereRaw(`accounts.login ILIKE ?`, [`%${query.search}%`])
                    .orWhereRaw(`accounts.name ILIKE ?`, [`%${query.search}%`]);
            });
        }

        // Получаем общее количество
        const countQuery = this.db<ParticipantLog>(this.tableName)
            .where({ [`${this.tableName}.project_id`]: projectId });
        
        // Применяем те же фильтры для подсчёта
        if (query.action) {
            countQuery.where({ [`${this.tableName}.action`]: query.action });
        }
        if (query.actor) {
            countQuery.where({ [`${this.tableName}.actor`]: query.actor });
        }
        if (query.participantId) {
            countQuery.where({ participant_id: parseInt(query.participantId, 10) });
        }
        if (query.userId) {
            countQuery.where({ [`${this.tableName}.user_id`]: parseInt(query.userId, 10) });
        }
        if (query.dateStart) {
            countQuery.where(`${this.tableName}.created_at`, ">=", new Date(query.dateStart));
        }
        if (query.dateEnd) {
            const endDate = new Date(query.dateEnd);
            endDate.setHours(23, 59, 59, 999);
            countQuery.where(`${this.tableName}.created_at`, "<=", endDate);
        }

        const countResult = await countQuery.count("id as count").first();
        const total = Number((countResult as any)?.count || 0);

        // Получаем записи с сортировкой по дате (новые первые)
        const logs = await baseQuery
            .clone()
            .orderBy(`${this.tableName}.created_at`, "DESC")
            .offset(offset)
            .limit(limit) as ParticipantLogWithUser[];

        return [logs, { total }];
    }

    /**
     * Получить логи по участнику
     */
    async getByParticipantId(participantId: number): Promise<ParticipantLogWithUser[]> {
        return this.db<ParticipantLog>(this.tableName)
            .where({ participant_id: participantId })
            .leftJoin("accounts", `${this.tableName}.user_id`, "accounts.id")
            .select(
                `${this.tableName}.*`,
                "accounts.login as user_login",
                "accounts.name as user_name"
            )
            .orderBy(`${this.tableName}.created_at`, "DESC") as Promise<ParticipantLogWithUser[]>;
    }

    /**
     * Удалить все логи проекта (жёсткое удаление)
     */
    async deleteAllByProject(projectId: number): Promise<number> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId })
            .del();
        return result;
    }
}

export const participantLogsDAL = new ParticipantLogsDAL();
