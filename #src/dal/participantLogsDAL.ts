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
    async getStats(projectId: number, dateStart?: string, dateEnd?: string): Promise<LogStats> {
        let baseQuery = this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId });

        // Фильтр по датам
        if (dateStart) {
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, ">=", new Date(dateStart));
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setHours(23, 59, 59, 999);
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, "<=", endDate);
        }

        const result = await baseQuery
            .clone()
            .select("action")
            .count("id as count")
            .groupBy("action");

        const stats: LogStats = {
            CREATE: 0,
            UPDATE: 0,
            DELETE: 0,
            PRINT: 0,
            uniqPrints: 0,
        };

        for (const row of result) {
            const action = row.action as LogAction;
            stats[action] = Number((row as any).count);
        }

        // Подсчёт уникальных печатей (несколько печатей одного участника считаются за 1)
        let uniqPrintsQuery = this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, action: 'PRINT' })
            .whereNotNull('participant_id');

        if (dateStart) {
            uniqPrintsQuery = uniqPrintsQuery.where(`${this.tableName}.created_at`, ">=", new Date(dateStart));
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setHours(23, 59, 59, 999);
            uniqPrintsQuery = uniqPrintsQuery.where(`${this.tableName}.created_at`, "<=", endDate);
        }

        const uniqPrintsResult = await uniqPrintsQuery
            .countDistinct('participant_id as count')
            .first();

        stats.uniqPrints = Number((uniqPrintsResult as any)?.count || 0);

        return stats;
    }

    /**
     * Получить количество уникальных печатей (по participant_id)
     */
    async getUniqPrintsCount(projectId: number): Promise<number> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, action: 'PRINT' })
            .whereNotNull('participant_id')
            .countDistinct('participant_id as count')
            .first();

        return Number((result as any)?.count || 0);
    }

    /**
     * Получить количество печатей по каждому участнику
     */
    async getPrintCountsByParticipant(projectId: number): Promise<Map<number, number>> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, action: 'PRINT' })
            .whereNotNull('participant_id')
            .select('participant_id')
            .count('id as count')
            .groupBy('participant_id');

        const map = new Map<number, number>();
        for (const row of result) {
            map.set(Number(row.participant_id), Number((row as any).count));
        }
        return map;
    }

    /**
     * Получить время первой печати по каждому участнику
     */
    async getFirstPrintByParticipant(projectId: number): Promise<Map<number, Date>> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, action: 'PRINT' })
            .whereNotNull('participant_id')
            .select('participant_id')
            .min('created_at as first_print_at')
            .groupBy('participant_id');

        const map = new Map<number, Date>();
        for (const row of result) {
            map.set(Number(row.participant_id), new Date((row as any).first_print_at));
        }
        return map;
    }


    /**
     * Получить все логи проекта без пагинации
     */
    async getAllByProjectId(
        projectId: number,
        query: Omit<LogsQuery, 'page' | 'limit'>
    ): Promise<ParticipantLogWithUser[]> {
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
                this.whereRaw(`participant_logs.current_data::text ILIKE ?`, [`%${query.search}%`])
                    .orWhereRaw(`accounts.login ILIKE ?`, [`%${query.search}%`])
                    .orWhereRaw(`accounts.name ILIKE ?`, [`%${query.search}%`]);
            });
        }

        // Возвращаем все записи с сортировкой по дате (новые первые)
        return baseQuery.orderBy(`${this.tableName}.created_at`, "DESC") as Promise<ParticipantLogWithUser[]>;
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

    /**
     * Удалить только логи печати (action = 'PRINT')
     */
    async deletePrintLogs(projectId: number): Promise<number> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, action: 'PRINT' })
            .del();
        return result;
    }

    /**
     * Получить статистику оператора по участникам
     * Возвращает список участников с которыми взаимодействовал оператор
     * и детализацию действий (создал, изменил, количество печатей)
     */
    async getOperatorStats(
        projectId: number,
        userId: number,
        dateStart?: string,
        dateEnd?: string
    ): Promise<{
        participants: {
            participantId: number;
            currentData: Record<string, any>;
            created: boolean;
            updated: boolean;
            printCount: number;
        }[];
        totalParticipants: number;
    }> {
        // Базовый запрос - логи данного оператора в проекте
        let baseQuery = this.db<ParticipantLog>(this.tableName)
            .where({ project_id: projectId, user_id: userId })
            .whereNotNull('participant_id');

        // Фильтр по датам
        if (dateStart) {
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, ">=", new Date(dateStart));
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setHours(23, 59, 59, 999);
            baseQuery = baseQuery.where(`${this.tableName}.created_at`, "<=", endDate);
        }

        // Агрегируем данные по participant_id
        const aggregated = await baseQuery
            .clone()
            .select('participant_id')
            .select(this.db.raw(`
                bool_or(action = 'CREATE') as created,
                bool_or(action = 'UPDATE') as updated,
                SUM(CASE WHEN action = 'PRINT' THEN 1 ELSE 0 END)::int as print_count
            `))
            .groupBy('participant_id');

        // Получаем current_data из последней записи каждого участника
        const participantIds = aggregated.map((r: any) => r.participant_id);
        
        // Подзапрос для получения последней current_data по каждому participant_id
        const latestData = participantIds.length > 0 
            ? await this.db.raw(`
                SELECT DISTINCT ON (participant_id) 
                    participant_id, 
                    current_data
                FROM participant_logs
                WHERE project_id = ? 
                    AND user_id = ? 
                    AND participant_id = ANY(?)
                    AND current_data IS NOT NULL
                ORDER BY participant_id, created_at DESC
            `, [projectId, userId, participantIds])
            : { rows: [] };

        // Создаём map для быстрого доступа
        const dataMap = new Map<number, Record<string, any>>();
        for (const row of latestData.rows) {
            dataMap.set(row.participant_id, row.current_data);
        }

        const result = aggregated.map((row: any) => ({
            ...row,
            current_data: dataMap.get(row.participant_id) || {}
        }));

        const participants = result.map((row: any) => ({
            participantId: row.participant_id,
            currentData: row.current_data,
            created: row.created || false,
            updated: row.updated || false,
            printCount: Number(row.print_count) || 0,
        }));

        return {
            participants,
            totalParticipants: participants.length,
        };
    }

    /**
     * Получить количество печатей по user_id
     */
    async getPrintCountByUserId(userId: number): Promise<number> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ user_id: userId, action: 'PRINT' })
            .count('id as count')
            .first();

        return Number((result as any)?.count || 0);
    }

    /**
     * Получить количество печатей по participant_id
     */
    async getPrintCountByParticipantId(participantId: number): Promise<number> {
        const result = await this.db<ParticipantLog>(this.tableName)
            .where({ participant_id: participantId, action: 'PRINT' })
            .count('id as count')
            .first();

        return Number((result as any)?.count || 0);
    }
}

export const participantLogsDAL = new ParticipantLogsDAL();
