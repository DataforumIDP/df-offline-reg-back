// Интерфейс участника
export interface Participant {
    id: number;
    project_id: number;
    data: Record<string, any>;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
    print_count?: number; // Количество печатей (заполняется в getByProjectId)
}

// JSON представление для API
export interface ParticipantJSON {
    id: number;
    projectId: number;
    data: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    printCount?: number;
}

// Хелпер для работы с участниками
export class ParticipantHelper {
    static toJSON(participant: Participant): ParticipantJSON {
        const json: ParticipantJSON = {
            id: participant.id,
            projectId: participant.project_id,
            data: participant.data,
            createdAt: participant.created_at.toISOString(),
            updatedAt: participant.updated_at.toISOString(),
        };
        if (participant.print_count !== undefined) {
            json.printCount = participant.print_count;
        }
        return json;
    }
}
