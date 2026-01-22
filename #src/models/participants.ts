// Интерфейс участника
export interface Participant {
    id: number;
    project_id: number;
    data: Record<string, any>;
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

// JSON представление для API
export interface ParticipantJSON {
    id: number;
    projectId: number;
    data: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

// Хелпер для работы с участниками
export class ParticipantHelper {
    static toJSON(participant: Participant): ParticipantJSON {
        return {
            id: participant.id,
            projectId: participant.project_id,
            data: participant.data,
            createdAt: participant.created_at.toISOString(),
            updatedAt: participant.updated_at.toISOString(),
        };
    }
}
