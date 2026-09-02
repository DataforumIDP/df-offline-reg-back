export type ScanMode = 'base' | 'direction' | 'view';

export type ScanActionType = 'none' | 'print' | 'change';

export interface ScanAction {
    type: ScanActionType;
    fieldKey?: string;
    value?: string | boolean;
}

export interface ScanActionRule {
    prefix: string;
    type: ScanActionType;
    fieldKey?: string;
    value?: string | boolean;
}

export interface Project {
    id: number;
    title: string;
    slug: string;
    description: string;
    dateStart: Date;
    dateEnd: Date;
    isOperatorEditable: boolean;
    colorRow: boolean;
    repeatPrintEnabled: boolean;
    repeat_print_enabled?: boolean;
    repeatPrintCount: number;
    repeat_print_count?: number;
    rulesField: string | null;
    rules_field?: string | null;
    scanMode: ScanMode;
    scan_mode?: ScanMode;
    scanAction: ScanAction | null;
    scan_action?: ScanAction | null;
    scanActionRules: ScanActionRule[];
    scan_action_rules?: ScanActionRule[] | null;
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
            repeatPrintEnabled: project.repeatPrintEnabled ?? project.repeat_print_enabled ?? false,
            repeatPrintCount: project.repeatPrintCount ?? project.repeat_print_count ?? 1,
            rulesField: project.rulesField ?? project.rules_field ?? null,
            scanMode: project.scanMode ?? project.scan_mode ?? 'base',
            scanAction: project.scanAction ?? project.scan_action ?? null,
            scanActionRules: project.scanActionRules ?? project.scan_action_rules ?? [],
            journalEnabled: project.journalEnabled ?? project.journal_enabled ?? false,
        };
    }

    static validateDates(dateStart: string | Date, dateEnd: string | Date): boolean {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        return end >= start;
    }
}
