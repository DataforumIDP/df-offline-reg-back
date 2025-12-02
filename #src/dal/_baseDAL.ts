import { Knex } from "knex";
import { db } from "../config/db";

export class BaseDAL {
    protected tableName: string;
    protected db: Knex;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.db = db;
    }

    async create(data: any) {
        const [result] = await this.db(this.tableName)
            .insert(data)
            .returning('*');
        return result;
    }

    async updateOne(id: number, params: any) {
        params.updated_at = this.db.fn.now();
        const [result] = await this.db(this.tableName)
            .where({ id })
            .update(params)
            .returning('*');
        return result;
    }

    async updateMany(entityIds: number[], params: any) {
        params.updated_at = this.db.fn.now();
        return await this.db(this.tableName)
            .whereIn('id', entityIds)
            .update(params)
            .returning('*');
    }

    async updateByConditions(conditions: any, params: any) {
        params.updated_at = this.db.fn.now();
        return await this.db(this.tableName)
            .where(conditions)
            .update(params)
            .returning('*');
    }


    addDeleteConditions(whereConditions: any[]) {
        whereConditions.push({
            is_delete: false,
        });
        return whereConditions;
    }

    addDateConditions(
        params: { dateRange?: string[] },
        whereConditions: any[]
    ) {
        const { dateRange } = params;

        if (dateRange) {
            const [startDate, endDate] = dateRange;

            if (startDate && !endDate) {
                const startOfDay = new Date(startDate);
                startOfDay.setUTCHours(0, 0, 0, 0);

                const endOfDay = new Date(startDate);
                endOfDay.setUTCHours(23, 59, 59, 999);

                whereConditions.push({
                    pub_date: {
                        '>=': startOfDay.toISOString(),
                        '<=': endOfDay.toISOString(),
                    },
                });
            } else if (startDate && endDate) {
                whereConditions.push({
                    pub_date: {
                        '>=': startDate,
                        '<=': endDate,
                    },
                });
            }
        }

        return whereConditions;
    }

    async _get(params: any) {
        let {
            whereConditions = [],
            search = "",
            limit = 20,
            offset = 0,
            order = [["created_at", "DESC"]],
        } = params;

        const query = this.db(this.tableName);

        // Применяем условия where
        whereConditions = this.addDeleteConditions(whereConditions);
        whereConditions.forEach((condition: any) => {
            if (typeof condition === 'object' && !Array.isArray(condition)) {
                Object.entries(condition).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        // Обработка операторов типа >=, <=
                        Object.entries(value).forEach(([op, val]) => {
                            if (op === '>=') query.where(key, '>=', val);
                            else if (op === '<=') query.where(key, '<=', val);
                            else query.where(key, op as any, val);
                        });
                    } else {
                        query.where(key, value as any);
                    }
                });
            }
        });

        // Сортировка
        if (Array.isArray(order)) {
            order.forEach(([column, direction]) => {
                query.orderBy(column, direction.toLowerCase());
            });
        }

        const countQuery = query.clone().count('* as count');
        const dataQuery = query.clone().limit(limit).offset(offset);

        const [data, countResult] = await Promise.all([
            dataQuery,
            countQuery,
        ]);

        const total = parseInt((countResult[0] as any).count, 10);

        return [data, { total }];
    }

    async findByPk(pk: number) {
        return await this.db(this.tableName)
            .where({ id: pk })
            .first();
    }

    async findOne(where: any) {
        where.is_delete = false;
        return await this.db(this.tableName)
            .where(where)
            .first();
    }

    async _delete(ids: number[]) {
        return this.updateMany(ids, { is_delete: true });
    }
}
