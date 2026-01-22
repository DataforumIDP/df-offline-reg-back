import { BaseDAL } from "./_baseDAL";
import { PrintTemplate, ProjectPrintTemplate } from "../models/printTemplates";

export interface PrintTemplatesQuery {
    search?: string;
}

export interface CreatePrintTemplateData {
    name: string;
    settings?: Record<string, any>;
    preloader?: string | null;
}

export interface UpdatePrintTemplateData {
    name?: string;
    settings?: Record<string, any>;
    preloader?: string | null;
}

export class PrintTemplatesDAL extends BaseDAL {
    constructor() {
        super("print_templates");
    }

    /**
     * Получить все шаблоны с поиском
     */
    async getAll(query: PrintTemplatesQuery): Promise<PrintTemplate[]> {
        let baseQuery = this.db<PrintTemplate>(this.tableName)
            .where({ is_delete: false })
            .orderBy("name", "ASC");

        if (query.search && query.search.trim()) {
            baseQuery = baseQuery.where("name", "ILIKE", `%${query.search}%`);
        }

        return baseQuery;
    }

    /**
     * Получить шаблон по ID
     */
    async getById(id: number): Promise<PrintTemplate | null> {
        const result = await this.db<PrintTemplate>(this.tableName)
            .where({ id, is_delete: false })
            .first();
        return result || null;
    }

    /**
     * Создать шаблон
     */
    async create(data: CreatePrintTemplateData): Promise<PrintTemplate> {
        const [template] = await this.db<PrintTemplate>(this.tableName)
            .insert({
                name: data.name,
                settings: (data.settings || {}) as any,
                preloader: data.preloader || null,
            })
            .returning("*");
        return template;
    }

    /**
     * Обновить шаблон
     */
    async update(id: number, data: UpdatePrintTemplateData): Promise<PrintTemplate | null> {
        const updateData: Partial<PrintTemplate> = {};

        if (data.name !== undefined) updateData.name = data.name;
        if (data.settings !== undefined) updateData.settings = data.settings as any;
        if (data.preloader !== undefined) updateData.preloader = data.preloader;

        const [template] = await this.db<PrintTemplate>(this.tableName)
            .where({ id, is_delete: false })
            .update({
                ...updateData,
                updated_at: new Date(),
            })
            .returning("*");

        return template || null;
    }

    /**
     * Мягкое удаление шаблона
     */
    async softDelete(id: number): Promise<boolean> {
        const count = await this.db<PrintTemplate>(this.tableName)
            .where({ id, is_delete: false })
            .update({
                is_delete: true,
                updated_at: new Date(),
            });
        return count > 0;
    }

    /**
     * Назначить шаблон проекту
     */
    async assignToProject(projectId: number, templateId: number): Promise<ProjectPrintTemplate> {
        // Используем upsert - если связь уже есть, обновляем
        await this.db.raw(`
            INSERT INTO project_print_templates (project_id, template_id, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW())
            ON CONFLICT (project_id) 
            DO UPDATE SET template_id = ?, updated_at = NOW()
        `, [projectId, templateId, templateId]);

        const result = await this.db<ProjectPrintTemplate>("project_print_templates")
            .where({ project_id: projectId })
            .first();

        return result!;
    }

    /**
     * Удалить связь проекта с шаблоном
     */
    async removeFromProject(projectId: number): Promise<boolean> {
        const count = await this.db<ProjectPrintTemplate>("project_print_templates")
            .where({ project_id: projectId })
            .delete();
        return count > 0;
    }

    /**
     * Получить шаблон проекта
     */
    async getByProjectId(projectId: number): Promise<PrintTemplate | null> {
        const result = await this.db<PrintTemplate>(this.tableName)
            .join(
                "project_print_templates",
                "print_templates.id",
                "project_print_templates.template_id"
            )
            .where({
                "project_print_templates.project_id": projectId,
                "print_templates.is_delete": false,
            })
            .select("print_templates.*")
            .first();

        return result || null;
    }
}

export const printTemplatesDAL = new PrintTemplatesDAL();
