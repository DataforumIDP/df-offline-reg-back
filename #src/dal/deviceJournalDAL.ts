import { BaseDAL } from "./_baseDAL";
import { DeviceJournalRecord, DeviceJournalStats } from "../models/deviceJournal";

export interface JournalQuery {
    page?: string;
    limit?: string;
    search?: string;
    isReturned?: string; // 'true' | 'false' | undefined (all)
    zoneId?: string;
    dateStart?: string;
    dateEnd?: string;
}

export interface CreateJournalRecordData {
    projectId: number;
    zoneId?: number | null;
    scannerId?: number | null;
    scannerName?: string | null;
    zoneName?: string | null;
    userCode: string;
    userName?: string | null;
    participantId?: number | null;
}

export class DeviceJournalDAL extends BaseDAL {
    constructor() {
        super("device_journal");
    }

    /**
     * Создать запись о выдаче
     */
    async checkout(data: CreateJournalRecordData): Promise<DeviceJournalRecord> {
        const [record] = await this.db<DeviceJournalRecord>(this.tableName)
            .insert({
                project_id: data.projectId,
                zone_id: data.zoneId ?? null,
                scanner_id: data.scannerId ?? null,
                scanner_name: data.scannerName ?? null,
                zone_name: data.zoneName ?? null,
                user_code: data.userCode,
                user_name: data.userName ?? null,
                participant_id: data.participantId ?? null,
                checkout_at: new Date(),
                is_returned: false,
                manual_return: false,
            })
            .returning("*");
        return record;
    }

    /**
     * Отметить устройство как сданное (по userCode в проекте)
     */
    async checkin(projectId: number, userCode: string, manual: boolean = false): Promise<DeviceJournalRecord | null> {
        const [record] = await this.db<DeviceJournalRecord>(this.tableName)
            .where({
                project_id: projectId,
                user_code: userCode,
                is_returned: false,
            })
            .update({
                is_returned: true,
                checkin_at: new Date(),
                manual_return: manual,
                updated_at: new Date(),
            })
            .returning("*");
        return record || null;
    }

    /**
     * Отметить запись как сданную по ID
     */
    async checkinById(id: number, manual: boolean = false): Promise<DeviceJournalRecord | null> {
        const [record] = await this.db<DeviceJournalRecord>(this.tableName)
            .where({ id, is_returned: false })
            .update({
                is_returned: true,
                checkin_at: new Date(),
                manual_return: manual,
                updated_at: new Date(),
            })
            .returning("*");
        return record || null;
    }

    /**
     * Найти активную запись (не сданную) по userCode
     */
    async findActiveByUserCode(projectId: number, userCode: string): Promise<DeviceJournalRecord | null> {
        const record = await this.db<DeviceJournalRecord>(this.tableName)
            .where({
                project_id: projectId,
                user_code: userCode,
                is_returned: false,
            })
            .orderBy("checkout_at", "desc")
            .first();
        return record || null;
    }

    /**
     * Получить записи журнала с пагинацией
     */
    async getAll(projectId: number, query: JournalQuery): Promise<{
        records: DeviceJournalRecord[];
        totalRecords: number;
        totalPages: number;
        page: number;
        limit: number;
    }> {
        const page = Math.max(1, parseInt(query.page || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit || "50", 10)));
        const offset = (page - 1) * limit;

        let baseQuery = this.db<DeviceJournalRecord>(this.tableName)
            .where({ project_id: projectId });

        // Фильтр по статусу возврата
        if (query.isReturned === "true") {
            baseQuery = baseQuery.where({ is_returned: true });
        } else if (query.isReturned === "false") {
            baseQuery = baseQuery.where({ is_returned: false });
        }

        // Фильтр по зоне
        if (query.zoneId) {
            baseQuery = baseQuery.where({ zone_id: parseInt(query.zoneId, 10) });
        }

        // Фильтр по датам
        if (query.dateStart) {
            baseQuery = baseQuery.where("checkout_at", ">=", new Date(query.dateStart));
        }
        if (query.dateEnd) {
            const endDate = new Date(query.dateEnd);
            endDate.setHours(23, 59, 59, 999);
            baseQuery = baseQuery.where("checkout_at", "<=", endDate);
        }

        // Поиск по имени или коду
        if (query.search) {
            const searchTerm = `%${query.search}%`;
            baseQuery = baseQuery.where((qb) => {
                qb.whereILike("user_name", searchTerm)
                  .orWhereILike("user_code", searchTerm);
            });
        }

        // Подсчёт общего количества
        const countResult = await baseQuery.clone().count("* as count").first();
        const totalRecords = Number((countResult as any)?.count || 0);
        const totalPages = Math.ceil(totalRecords / limit);

        // Получаем записи
        const records = await baseQuery
            .orderBy("checkout_at", "desc")
            .limit(limit)
            .offset(offset);

        return {
            records,
            totalRecords,
            totalPages,
            page,
            limit,
        };
    }

    /**
     * Получить статистику журнала
     */
    async getStats(projectId: number): Promise<DeviceJournalStats> {
        const result = await this.db<DeviceJournalRecord>(this.tableName)
            .where({ project_id: projectId })
            .select(
                this.db.raw("COUNT(*) as total"),
                this.db.raw("COUNT(*) FILTER (WHERE is_returned = false) as on_hands"),
                this.db.raw("COUNT(*) FILTER (WHERE is_returned = true) as returned")
            )
            .first();

        return {
            total: Number((result as any)?.total || 0),
            onHands: Number((result as any)?.on_hands || 0),
            returned: Number((result as any)?.returned || 0),
        };
    }

    /**
     * Получить запись по ID
     */
    async getById(id: number): Promise<DeviceJournalRecord | null> {
        const record = await this.db<DeviceJournalRecord>(this.tableName)
            .where({ id })
            .first();
        return record || null;
    }
}

export const deviceJournalDAL = new DeviceJournalDAL();
