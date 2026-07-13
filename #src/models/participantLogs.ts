export type LogAction = "CREATE" | "UPDATE" | "DELETE" | "PRINT";
export type LogActor = "USER" | "WEBHOOK" | "AUTO" | "SCANNER";

export interface ParticipantLog {
    id: number;
    project_id: number;
    participant_id: number | null;
    action: LogAction;
    actor: LogActor;
    user_id: number | null;
    current_data: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}

export interface ParticipantLogWithUser extends ParticipantLog {
    user_login?: string;
    user_name?: string;
}

export interface ParticipantLogJSON {
    id: number;
    projectId: number;
    participantId: number | null;
    action: LogAction;
    actor: LogActor;
    userId: number | null;
    user?: {
        id: number;
        login: string;
        name: string | null;
    } | null;
    currentData: Record<string, any>;
    createdAt: string;
}

export interface LogStats {
    CREATE: number;
    UPDATE: number;
    DELETE: number;
    PRINT: number;
    uniqPrints: number;
}

export class ParticipantLogHelper {
    static toJSON(log: ParticipantLogWithUser): ParticipantLogJSON {
        return {
            id: log.id,
            projectId: log.project_id,
            participantId: log.participant_id,
            action: log.action,
            actor: log.actor,
            userId: log.user_id,
            user: log.user_id ? {
                id: log.user_id,
                login: log.user_login || '',
                name: log.user_name || null,
            } : null,
            currentData: log.current_data,
            createdAt: log.created_at.toISOString(),
        };
    }
}
