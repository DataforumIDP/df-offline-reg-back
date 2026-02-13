import { BaseDAL } from "./_baseDAL";
import { _offset } from "../utils/getOffset";

export class AccountsDAL extends BaseDAL {
    constructor() {
        super('accounts');
    }

    async getByLoginAndRoles(login: string, roles: string[], isDelete?: boolean) {
        const query = this.db(this.tableName)
            .where({ login: login.toLowerCase() })
            .whereIn('role', roles);

        if (isDelete !== undefined) {
            query.where({ is_delete: isDelete });
        } else {
            query.where({ is_delete: false });
        }

        return await query.first();
    }

    async get(params: any) {
        const { page, search, limit } = params;

        const offset = _offset(page, limit);

        const whereConditions: any[] = [];

        if (search) {
            // Для Knex используем orWhere в отдельном запросе
            const query = this.db(this.tableName)
                .where({ is_delete: false })
                .where(function() {
                    this.where('name', 'ilike', `%${search}%`)
                        .orWhere('login', 'ilike', `%${search}%`)
                        .orWhere('role', 'ilike', `%${search}%`);
                })
                .orderBy('created_at', 'desc')
                .limit(limit || 20)
                .offset(offset);

            const countQuery = this.db(this.tableName)
                .where({ is_delete: false })
                .where(function() {
                    this.where('name', 'ilike', `%${search}%`)
                        .orWhere('login', 'ilike', `%${search}%`)
                        .orWhere('role', 'ilike', `%${search}%`);
                })
                .count('* as count');

            const [data, countResult] = await Promise.all([
                query,
                countQuery,
            ]);

            const total = parseInt((countResult[0] as any).count, 10);

            return [data, { total }];
        }

        return this._get({
            whereConditions,
            search,
            limit: limit || 20,
            offset,
        });
    }

    async getByProjectId(projectId: number, params: any) {
        const { page, search, limit } = params;
        const offset = _offset(page, limit);

        let query = this.db(this.tableName)
            .where({ is_delete: false, projectId });

        let countQuery = this.db(this.tableName)
            .where({ is_delete: false, projectId });

        if (search) {
            query = query.where(function() {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('login', 'ilike', `%${search}%`);
            });

            countQuery = countQuery.where(function() {
                this.where('name', 'ilike', `%${search}%`)
                    .orWhere('login', 'ilike', `%${search}%`);
            });
        }

        query = query
            .orderBy('created_at', 'desc')
            .limit(limit || 20)
            .offset(offset);

        countQuery = countQuery.count('* as count');

        const [data, countResult] = await Promise.all([
            query,
            countQuery,
        ]);

        const total = parseInt((countResult[0] as any).count, 10);

        return [data, { total }];
    }

    /**
     * Получить одного пользователя по ID
     */
    async getById(id: number) {
        return this.db(this.tableName)
            .where({ id, is_delete: false })
            .first();
    }
}
