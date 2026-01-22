import { BaseDAL } from "./_baseDAL";
import { Participant } from "../models/participants";
import { parseSearchQuery, buildSearchSQL } from "../utils/searchUtils";

export interface ParticipantsQuery {
    page?: string;
    limit?: string;
    search?: string;
    order?: string;
    direction?: 'ASC' | 'DESC';
}

export class ParticipantsDAL extends BaseDAL {
    constructor() {
        super("participants");
    }

    /**
     * Получить максимальное значение поля типа id в проекте
     */
    async getMaxIdFieldValue(projectId: number, fieldKey: string): Promise<number> {
        const result = await this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false })
            .whereRaw(`data->>'${fieldKey}' IS NOT NULL`)
            .select(this.db.raw(`MAX((data->>'${fieldKey}')::int) as max_val`))
            .first();
        return (result as any)?.max_val || 0;
    }

    /**
     * Проверить уникальность значения поля в проекте
     */
    async isFieldValueUnique(
        projectId: number,
        fieldKey: string,
        value: any,
        excludeId?: number
    ): Promise<boolean> {
        let query = this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false })
            .whereRaw(`data->>'${fieldKey}' = ?`, [String(value)]);

        if (excludeId) {
            query = query.whereNot({ id: excludeId });
        }

        const existing = await query.first();
        return !existing;
    }

    /**
     * Получить участников проекта с пагинацией и продвинутым поиском
     * 
     * Поддержка поиска:
     * - Регистронезависимый поиск по всем полям
     * - Триграммный поиск (нечёткий, с опечатками)
     * - Автоматическая конвертация раскладки RU<->EN
     * - Поиск по телефонам (только цифры)
     * - Комбинированный поиск: пробел = AND, || = OR
     * - Поиск по конкретному ключу: {{key: value}}
     * 
     * Примеры запросов:
     * - "Иванов Иван" - найти где есть и Иванов И Иван
     * - "Bdfy" - найдёт Иван (конвертация раскладки)
     * - "8005553535" - найдёт 8 800 555-35-35 (нормализация телефона)
     * - "Иванов || VIP" - найти где Иванов ИЛИ VIP
     * - "{{work: НИИ}}" - поиск по полю work
     */
    async getByProjectId(
        projectId: number,
        query: ParticipantsQuery
    ): Promise<[Participant[], { total: number }]> {
        const page = Math.max(1, parseInt(query.page || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
        const offset = (page - 1) * limit;
        const order = query.order || "id";
        const direction = query.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC";

        // Базовый запрос
        let baseQuery = this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false });

        // Продвинутый поиск
        if (query.search && query.search.trim()) {
            const parsed = parseSearchQuery(query.search);
            const { sql, params } = buildSearchSQL(parsed);

            // Отладка: выводим сгенерированный SQL
            console.log('[Search Debug]', {
                originalQuery: query.search,
                parsed: JSON.stringify(parsed, null, 2),
                sql,
                params
            });

            if (sql) {
                // Устанавливаем порог схожести для триграмм (0.2 = 20% схожести)
                // Более низкий порог позволяет находить слова с бóльшим количеством опечаток
                await this.db.raw("SET pg_trgm.similarity_threshold = 0.2");
                baseQuery = baseQuery.whereRaw(sql, params);
            }
        }

        // Получаем общее количество
        const countResult = await baseQuery.clone().count("id as count").first();
        const total = Number((countResult as any)?.count || 0);

        // Получаем записи с сортировкой
        let recordsQuery = baseQuery.clone().offset(offset).limit(limit);
        
        if (order === "id" || order === "created_at" || order === "updated_at") {
            recordsQuery = recordsQuery.orderBy(order, direction);
        } else {
            // Сортировка по полю в JSONB
            recordsQuery = recordsQuery.orderByRaw(`data->>'${order}' ${direction}`);
        }

        const participants = await recordsQuery;

        return [participants, { total }];
    }

    /**
     * Получить участника по ID
     */
    async getById(id: number): Promise<Participant | null> {
        const result = await this.db<Participant>(this.tableName)
            .where({ id, is_delete: false })
            .first();
        return result || null;
    }

    /**
     * Получить участника по ID и project_id
     */
    async getByIdAndProject(id: number, projectId: number): Promise<Participant | null> {
        const result = await this.db<Participant>(this.tableName)
            .where({ id, project_id: projectId, is_delete: false })
            .first();
        return result || null;
    }

    /**
     * Создать участника
     */
    async create(data: {
        project_id: number;
        data: Record<string, any>;
    }): Promise<Participant> {
        const [result] = await this.db<Participant>(this.tableName)
            .insert({
                project_id: data.project_id,
                data: JSON.stringify(data.data),
            } as any)
            .returning("*");
        return result;
    }

    /**
     * Обновить данные участника
     */
    async update(id: number, data: Record<string, any>): Promise<Participant | null> {
        const [result] = await this.db<Participant>(this.tableName)
            .where({ id, is_delete: false })
            .update({
                data: JSON.stringify(data),
                updated_at: this.db.fn.now(),
            } as any)
            .returning("*");
        return result || null;
    }

    /**
     * Мягкое удаление участника
     */
    async softDelete(id: number): Promise<boolean> {
        const result = await this.db<Participant>(this.tableName)
            .where({ id })
            .update({
                is_delete: true,
                updated_at: this.db.fn.now(),
            });
        return result > 0;
    }
}
