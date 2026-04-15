export type ScanMode = 'base' | 'direction' | 'view';

export interface Project {
    id: number;
    title: string;
    slug: string;
    description: string;
    dateStart: Date;
    dateEnd: Date;
    isOperatorEditable: boolean;
    colorRow: boolean;
    rulesField: string | null;
    rules_field?: string | null;
    scanMode: ScanMode;
    scan_mode?: ScanMode;
    journalEnabled: boolean;
    journal_enabled?: boolean;
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
            colorRow: project.colorRow ?? false,
            rulesField: project.rulesField ?? project.rules_field ?? null,
            scanMode: project.scanMode ?? project.scan_mode ?? 'base',
            journalEnabled: project.journalEnabled ?? project.journal_enabled ?? false,
        };
    }

    static validateDates(dateStart: string | Date, dateEnd: string | Date): boolean {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        return end >= start;
    }
}
