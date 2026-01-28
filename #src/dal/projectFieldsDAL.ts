import { BaseDAL } from "./_baseDAL";
import { ProjectField, ProjectFieldConfig } from "../models/projectFields";

export class ProjectFieldsDAL extends BaseDAL {
    constructor() {
        super("project_fields");
    }

    // Получить все поля проекта
    async getByProjectId(projectId: number): Promise<ProjectField[]> {
        return this.db(this.tableName)
            .where({ project_id: projectId, is_delete: false })
            .orderBy('id', 'asc');
    }

    // Получить поле по ID
    async getById(id: number): Promise<ProjectField | null> {
        const result = await this.db(this.tableName)
            .where({ id, is_delete: false })
            .first();
        return result || null;
    }

    // Проверка уникальности label в рамках проекта
    async isLabelUnique(projectId: number, label: string, excludeId?: number): Promise<boolean> {
        const query = this.db(this.tableName)
            .where({ project_id: projectId, label, is_delete: false });
        
        if (excludeId) {
            query.whereNot({ id: excludeId });
        }

        const existing = await query.first();
        return !existing;
    }

    // Проверка уникальности key в рамках проекта
    async isKeyUnique(projectId: number, key: string, excludeId?: number): Promise<boolean> {
        const query = this.db(this.tableName)
            .where({ project_id: projectId, key, is_delete: false });
        
        if (excludeId) {
            query.whereNot({ id: excludeId });
        }

        const existing = await query.first();
        return !existing;
    }

    // Создать поле
    async createField(data: {
        project_id: number;
        label: string;
        key: string;
        config: ProjectFieldConfig;
    }): Promise<ProjectField> {
        const [result] = await this.db(this.tableName)
            .insert({
                project_id: data.project_id,
                label: data.label,
                key: data.key,
                config: JSON.stringify(data.config),
            })
            .returning('*');
        return result;
    }

    // Обновить поле (только для типа list)
    async updateField(id: number, config: ProjectFieldConfig): Promise<ProjectField | null> {
        const [result] = await this.db(this.tableName)
            .where({ id, is_delete: false })
            .update({
                config: JSON.stringify(config),
                updated_at: this.db.fn.now(),
            })
            .returning('*');
        return result || null;
    }

    // Обновить поле полностью (label, key, type, config)
    // При необходимости вызывается внутри транзакции: передавайте trx как опцию
    async updateFieldFull(id: number, data: {
        label?: string;
        key?: string;
        type?: string;
        config?: ProjectFieldConfig;
    }, trx?: any): Promise<ProjectField | null> {
        const qb = trx ? trx(this.tableName) : this.db(this.tableName);
        const params: any = {};

        if (data.label !== undefined) params.label = data.label;
        if (data.key !== undefined) params.key = data.key;
        if (data.type !== undefined) {
            // Если передан type вместе с config, используем config; иначе добавим type в существующий config
            if (data.config !== undefined) {
                params.config = JSON.stringify(data.config);
            } else {
                params.config = this.db.raw("config::jsonb || jsonb_build_object('type', ?)", [data.type]);
            }
        } else if (data.config !== undefined) {
            params.config = JSON.stringify(data.config);
        }

        params.updated_at = (trx ? trx.fn.now() : this.db.fn.now());

        const [result] = await qb
            .where({ id, is_delete: false })
            .update(params)
            .returning('*');

        return result || null;
    }

    // Мягкое удаление поля
    async softDelete(id: number): Promise<boolean> {
        const result = await this.db(this.tableName)
            .where({ id })
            .update({
                is_delete: true,
                updated_at: this.db.fn.now(),
            });
        return result > 0;
    }
}
