/**
 * Запись журнала учёта устройств
 */
export interface DeviceJournalRecord {
    id: number;
    project_id: number;
    zone_id: number | null;
    scanner_id: number | null;
    scanner_name: string | null;
    zone_name: string | null;
    user_code: string;
    user_name: string | null;
    participant_id: number | null;
    checkout_at: Date;
    checkin_at: Date | null;
    is_returned: boolean;
    manual_return: boolean;
    created_at: Date;
    updated_at: Date;
}

/**
 * Запись с camelCase для API
 */
export interface DeviceJournalRecordJSON {
    id: number;
    projectId: number;
    zoneId: number | null;
    scannerId: number | null;
    scannerName: string | null;
    zoneName: string | null;
    userCode: string;
    userName: string | null;
    participantId: number | null;
    checkoutAt: string;
    checkinAt: string | null;
    isReturned: boolean;
    manualReturn: boolean;
    createdAt: string;
    updatedAt: string;
}

export class DeviceJournalHelper {
    static toJSON(record: DeviceJournalRecord): DeviceJournalRecordJSON {
        return {
            id: record.id,
            projectId: record.project_id,
            zoneId: record.zone_id,
            scannerId: record.scanner_id,
            scannerName: record.scanner_name,
            zoneName: record.zone_name,
            userCode: record.user_code,
            userName: record.user_name,
            participantId: record.participant_id,
            checkoutAt: record.checkout_at?.toISOString?.() ?? String(record.checkout_at),
            checkinAt: record.checkin_at?.toISOString?.() ?? (record.checkin_at ? String(record.checkin_at) : null),
            isReturned: record.is_returned,
            manualReturn: record.manual_return,
            createdAt: record.created_at?.toISOString?.() ?? String(record.created_at),
            updatedAt: record.updated_at?.toISOString?.() ?? String(record.updated_at),
        };
    }
}

/**
 * Статистика журнала
 */
export interface DeviceJournalStats {
    total: number;
    onHands: number;
    returned: number;
}
