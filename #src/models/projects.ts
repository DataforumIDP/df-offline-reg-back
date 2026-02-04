export type ScanMode = 'base' | 'direction' | 'view';

export interface Project {
    id: number;
    title: string;
    slug: string;
    description: string;
    dateStart: Date;
    dateEnd: Date;
    isOperatorEditable: boolean;
    rulesField: string | null; // Поле (список) для проверки доступа в зоны
    rules_field?: string | null; // snake_case версия из БД
    scanMode: ScanMode; // Режим сканирования
    scan_mode?: ScanMode; // snake_case версия из БД
    isDelete: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class ProjectHelper {
    static toJSON(project: Project) {
        return {
            id: project.id,
            title: project.title,
            slug: project.slug,
            description: project.description,
            dateStart: project.dateStart,
            dateEnd: project.dateEnd,
            isOperatorEditable: project.isOperatorEditable,
            rulesField: project.rulesField ?? project.rules_field ?? null,
            scanMode: project.scanMode ?? project.scan_mode ?? 'base',
        };
    }

    static validateDates(dateStart: string | Date, dateEnd: string | Date): boolean {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        return end >= start;
    }
}
