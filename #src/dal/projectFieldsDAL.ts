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
