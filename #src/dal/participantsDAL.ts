import { BaseDAL } from "./_baseDAL";
import { Participant } from "../models/participants";
import { parseSearchQuery, buildSearchSQL, buildRelevanceSQL } from "../utils/searchUtils";
import { ProjectFieldsDAL } from "./projectFieldsDAL";

const projectFieldsDAL = new ProjectFieldsDAL();

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

    // Проверка уникальности значения в рамках проекта
    async isValueUnique(projectId: number, fieldKey: string, value: string): Promise<boolean> {
        const result = await this.db(this.tableName)
            .where({ project_id: projectId, is_delete: false })
            .whereRaw(`data->>'${fieldKey}' = ?`, [value])
            .count();
        return parseInt(String(result[0].count), 10) === 0;
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
        const limit = Math.min(500, Math.max(1, parseInt(query.limit || "20", 10)));
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
        let searchParsed: ReturnType<typeof parseSearchQuery> | null = null;
        if (query.search && query.search.trim()) {
            searchParsed = parseSearchQuery(query.search);
            const { sql, params } = buildSearchSQL(searchParsed);

            // Отладка: выводим сгенерированный SQL
            console.log('[Search Debug]', {
                originalQuery: query.search,
                parsed: JSON.stringify(searchParsed, null, 2),
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
        
        // При поиске сортируем по релевантности, если не указана явная сортировка 
        // (order=id с direction=ASC считается дефолтной, игнорируем её при поиске)
        const isDefaultOrder = order === 'id' && direction === 'ASC';
        const useRelevanceSort = searchParsed && (isDefaultOrder || query.order === undefined);
        
        if (useRelevanceSort && searchParsed) {
            const { sql: relevanceSql, params: relevanceParams } = buildRelevanceSQL(searchParsed);
            if (relevanceSql !== '0') {
                // DEBUG: Выводим баллы релевантности для первых 10 записей
                const debugQuery = baseQuery.clone()
                    .select('id', 'data')
                    .select(this.db.raw(`${relevanceSql} as relevance_score`, relevanceParams))
                    .orderByRaw(`${relevanceSql} DESC`, relevanceParams)
                    .limit(10);
                const debugResults = await debugQuery;
                console.log('[Relevance Debug] Top 10 scores:');
                debugResults.forEach((r: any, i: number) => {
                    const name = r.data?.name || r.data?.firstName || 'N/A';
                    const surname = r.data?.surname || r.data?.lastName || r.data?.name2 || '';
                    console.log(`  ${i + 1}. ID=${r.id}, Score=${r.relevance_score}, Name="${name} ${surname}"`);
                });
                
                // Сортировка по релевантности (DESC - более релевантные первыми)
                recordsQuery = recordsQuery.orderByRaw(`${relevanceSql} DESC`, relevanceParams);
            }
        } else if (order === "id" || order === "created_at" || order === "updated_at") {
            recordsQuery = recordsQuery.orderBy(order, direction);
        } else {
            // Сортировка по полю в JSONB
            recordsQuery = recordsQuery.orderByRaw(`data->>'${order}' ${direction}`);
        }

        const participants = await recordsQuery;

        // Добавляем print_count для каждого участника одним запросом
        if (participants.length > 0) {
            const participantIds = participants.map(p => p.id);
            const printCounts = await this.db('participant_logs')
                .select('participant_id')
                .count('* as print_count')
                .whereIn('participant_id', participantIds)
                .where('action', 'PRINT')
                .groupBy('participant_id');

            const printCountMap = new Map<number, number>();
            printCounts.forEach((row: any) => {
                printCountMap.set(row.participant_id, Number(row.print_count));
            });

            participants.forEach((p: any) => {
                p.print_count = printCountMap.get(p.id) || 0;
            });
        }

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
        // Получаем поля проекта и применяем defaultValue для отсутствующих/пустых ключей
        try {
            const fields = await projectFieldsDAL.getByProjectId(data.project_id);
            const defaults: Record<string, any> = {};
            for (const f of fields) {
                const cfg: any = f.config || {};
                if (cfg.optional && cfg.defaultValue !== undefined) {
                    defaults[f.key] = cfg.defaultValue;
                }
            }

            const finalData = { ...data.data };
            for (const [k, dv] of Object.entries(defaults)) {
                if (finalData[k] === undefined || finalData[k] === '') {
                    finalData[k] = dv;
                }
            }

            const [result] = await this.db<Participant>(this.tableName)
                .insert({
                    project_id: data.project_id,
                    data: JSON.stringify(finalData),
                } as any)
                .returning("*");
            return result;
        } catch (err) {
            // В случае ошибки просто применяем оригинальные данные
            const [result] = await this.db<Participant>(this.tableName)
                .insert({
                    project_id: data.project_id,
                    data: JSON.stringify(data.data),
                } as any)
                .returning("*");
            return result;
        }
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
        // Получаем поля проекта и применяем defaultValue
        const fields = await projectFieldsDAL.getByProjectId(projectId);
        const defaults: Record<string, any> = {};
        for (const f of fields) {
            const cfg: any = f.config || {};
            if (cfg.optional && cfg.defaultValue !== undefined) {
                defaults[f.key] = cfg.defaultValue;
            }
        }

        const insertData = dataList.map(data => {
            const final = { ...data };
            for (const [k, dv] of Object.entries(defaults)) {
                if (final[k] === undefined || final[k] === '') {
                    final[k] = dv;
                }
            }
            return {
                project_id: projectId,
                data: JSON.stringify(final),
            };
        });

        const results = await this.db<Participant>(this.tableName)
            .insert(insertData as any)
            .returning("*");
        return results;
    }

    /**
     * Поиск участника по значению кода в любом из указанных полей
     * @param projectId - ID проекта
     * @param code - значение кода для поиска
     * @param codeFieldKeys - массив ключей полей типа code
     * @returns первый найденный участник или null
     */
    async findByCode(
        projectId: number,
        code: string,
        codeFieldKeys: string[]
    ): Promise<Participant | null> {
        if (codeFieldKeys.length === 0) {
            return null;
        }

        // Строим условие OR для всех полей типа code
        let query = this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false });

        // Добавляем условие поиска по любому из полей
        query = query.where(function() {
            for (const fieldKey of codeFieldKeys) {
                // Безопасность: проверяем формат ключа
                if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldKey)) {
                    this.orWhereRaw(`data->>'${fieldKey}' = ?`, [code]);
                }
            }
        });

        const result = await query.first();
        return result || null;
    }

    /**
     * Получить всех активных участников проекта (для предзагрузки)
     */
    async getActiveByProject(projectId: number): Promise<Participant[]> {
        return this.db<Participant>(this.tableName)
            .where({ project_id: projectId, is_delete: false });
    }
}
