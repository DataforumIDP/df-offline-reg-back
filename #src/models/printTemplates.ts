export interface PrintTemplate {
    id: number;
    name: string;
    settings: Record<string, any>;
    preloader: string | null;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface ProjectPrintTemplate {
    project_id: number;
    template_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface PrintTemplateJSON {
    id: number;
    name: string;
    settings: Record<string, any>;
    preloader: string | null;
    createdAt: string;
    updatedAt: string;
}

export class PrintTemplateHelper {
    static toJSON(template: PrintTemplate): PrintTemplateJSON {
        return {
            id: template.id,
            name: template.name,
            settings: template.settings,
            preloader: template.preloader,
            createdAt: template.created_at.toISOString(),
            updatedAt: template.updated_at.toISOString(),
        };
    }
}
