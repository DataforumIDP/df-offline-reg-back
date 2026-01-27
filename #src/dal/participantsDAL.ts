import { BaseDAL } from "./_baseDAL";
import { Participant } from "../models/participants";
import { parseSearchQuery, buildSearchSQL } from "../utils/searchUtils";

export interface ParticipantsQuery {
    page?: string;
    limit?: string;
    search?: string;
    order?: string;
    direction?: 'ASC' | 'DESC';
    filters?: string; // JSON строка вида {"key": "value", "key2": ["val1", "val2"]}
}

/**
 * Интерфейс для фильтров
 * - string значение: частичное совпадение (ILIKE) для text полей
 * - string[] значение: точное совпадение (ANY) для list/multiList полей
 */
export interface ParsedFilters {
    [key: string]: string | string[];
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
     * 
     * Поддержка фильтров (параметр filters):
     * - Для text полей: частичное совпадение (ILIKE)
     * - Для list/multiList: точное совпадение из массива значений
     * 
     * Примеры запросов поиска:
     * - "Иванов Иван" - найти где есть и Иванов И Иван
     * - "Bdfy" - найдёт Иван (конвертация раскладки)
     * - "8005553535" - найдёт 8 800 555-35-35 (нормализация телефона)
     * - "Иванов || VIP" - найти где Иванов ИЛИ VIP
     * 
     * Примеры фильтров:
     * - {"city": "Москва"} - участники из Москвы (частичное совпадение)
     * - {"status": ["VIP", "Спикер"]} - участники со статусом VIP или Спикер
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

        // Обработка фильтров
        if (query.filters) {
            try {
                const filters: ParsedFilters = JSON.parse(query.filters);
                
                for (const [key, value] of Object.entries(filters)) {
                    if (Array.isArray(value)) {
                        // Для массива - точное совпадение одного из значений
                        // Для multiList (массив в JSONB) используем пересечение
                        // Для обычного list - просто IN
                        if (value.length > 0) {
                            const placeholders = value.map(() => '?').join(', ');
                            baseQuery = baseQuery.whereRaw(
                                `(data->>? IN (${placeholders}) OR (data->? @> ANY(ARRAY[${value.map(() => '?::jsonb').join(', ')}])))`,
                                [key, ...value, key, ...value.map(v => JSON.stringify([v]))]
                            );
                        }
                    } else if (typeof value === 'string' && value.trim()) {
                        // Для строки - частичное совпадение ILIKE
                        baseQuery = baseQuery.whereRaw(
                            `data->>? ILIKE ?`,
                            [key, `%${value}%`]
                        );
                    }
                }
            } catch (e) {
                console.error('[Filters Parse Error]', e);
            }
        }

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

    /**
     * Получить всех участников проекта (для экспорта, без пагинации)
     * Поддерживает фильтры и поиск
     */
    async getAllByProjectId(
        projectId: number,
        query: ParticipantsQuery
    ): Promise<Participant[]> {
        const order = query.order || "id";
        const direction = query.direction?.toUpperCase() === "DESC" ? "DESC" : "ASC";

        // Базовый запрос
        let baseQuery = this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false });

        // Обработка фильтров (аналогично getByProjectId)
        if (query.filters) {
            try {
                const filters: ParsedFilters = JSON.parse(query.filters);
                
                for (const [key, value] of Object.entries(filters)) {
                    if (Array.isArray(value)) {
                        if (value.length > 0) {
                            const placeholders = value.map(() => '?').join(', ');
                            baseQuery = baseQuery.whereRaw(
                                `(data->>? IN (${placeholders}) OR (data->? @> ANY(ARRAY[${value.map(() => '?::jsonb').join(', ')}])))`,
                                [key, ...value, key, ...value.map(v => JSON.stringify([v]))]
                            );
                        }
                    } else if (typeof value === 'string' && value.trim()) {
                        baseQuery = baseQuery.whereRaw(
                            `data->>? ILIKE ?`,
                            [key, `%${value}%`]
                        );
                    }
                }
            } catch (e) {
                console.error('[Filters Parse Error]', e);
            }
        }

        // Поиск
        if (query.search && query.search.trim()) {
            const parsed = parseSearchQuery(query.search);
            const { sql, params } = buildSearchSQL(parsed);

            if (sql) {
                await this.db.raw("SET pg_trgm.similarity_threshold = 0.2");
                baseQuery = baseQuery.whereRaw(sql, params);
            }
        }

        // Сортировка
        if (order === "id" || order === "created_at" || order === "updated_at") {
            baseQuery = baseQuery.orderBy(order, direction);
        } else {
            baseQuery = baseQuery.orderByRaw(`data->>'${order}' ${direction}`);
        }

        return baseQuery;
    }

    /**
     * Удалить всех участников проекта (жёсткое удаление)
     */
    async deleteAllByProject(projectId: number): Promise<number> {
        const result = await this.db<Participant>(this.tableName)
            .where({ project_id: projectId })
            .del();
        return result;
    }

    /**
     * Пакетное создание участников
     */
    async createBatch(projectId: number, dataList: Record<string, any>[]): Promise<Participant[]> {
        const insertData = dataList.map(data => ({
            project_id: projectId,
            data: JSON.stringify(data),
        }));

        const results = await this.db<Participant>(this.tableName)
            .insert(insertData as any)
            .returning("*");
        return results;
    }
}
