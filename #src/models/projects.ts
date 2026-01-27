export interface Project {
    id: number;
    title: string;
    slug: string;
    description: string;
    dateStart: Date;
    dateEnd: Date;
    isOperatorEditable: boolean;
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
        };
    }

    static validateDates(dateStart: string | Date, dateEnd: string | Date): boolean {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        return end >= start;
    }
}
