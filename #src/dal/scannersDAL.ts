import { db } from "../config/db";
import {
    ProjectAuth,
    Scanner,
    ScannerLog,
    CreateScannerDTO,
    UpdateScannerDTO,
    CreateScannerLogDTO,
    ProjectAuthHelper,
} from "../models/scanners";

/**
 * DAL для авторизации проекта
 */
export class ProjectAuthDAL {
    private readonly table = "project_auth";

    /**
     * Получить или создать ключи авторизации для проекта
     */
    async getOrCreate(projectId: number): Promise<ProjectAuth> {
        let auth = await db(this.table).where({ project_id: projectId }).first();

        if (!auth) {
            const keys = ProjectAuthHelper.generateKeyPair();
            [auth] = await db(this.table)
                .insert({
                    project_id: projectId,
                    access_key: keys.accessKey,
                    secret_key: keys.secretKey,
                })
                .returning("*");
        }

        return auth;
    }

    /**
     * Получить авторизацию по project_id
     */
    async getByProjectId(projectId: number): Promise<ProjectAuth | null> {
        const auth = await db(this.table).where({ project_id: projectId }).first();
        return auth || null;
    }

    /**
     * Получить авторизацию по access_key
     */
    async getByAccessKey(accessKey: string): Promise<ProjectAuth | null> {
        const auth = await db(this.table).where({ access_key: accessKey }).first();
        return auth || null;
    }

    /**
     * Перегенерировать ключи
     */
    async regenerateKeys(projectId: number): Promise<ProjectAuth> {
        const keys = ProjectAuthHelper.generateKeyPair();
        const [auth] = await db(this.table)
            .where({ project_id: projectId })
            .update({
                access_key: keys.accessKey,
                secret_key: keys.secretKey,
                updated_at: db.fn.now(),
            })
            .returning("*");

        return auth;
    }
}

/**
 * DAL для сканеров
 */
export class ScannersDAL {
    private readonly table = "scanners";

    /**
     * Создать или обновить сканер
     */
    async upsert(data: CreateScannerDTO): Promise<Scanner> {
        // Проверяем, есть ли уже такой сканер
        const existing = await db(this.table)
            .where({ scanner_id: data.scannerId })
            .first();

        if (existing) {
            // Обновляем привязку к проекту и зоне
            const [updated] = await db(this.table)
                .where({ id: existing.id })
                .update({
                    project_id: data.projectId,
                    zone_id: data.zoneId,
                    name: data.name || existing.name,
                    last_seen_at: db.fn.now(),
                    updated_at: db.fn.now(),
                })
                .returning("*");
            return updated;
        }

        // Создаём новый сканер
        const [scanner] = await db(this.table)
            .insert({
                scanner_id: data.scannerId,
                project_id: data.projectId,
                zone_id: data.zoneId,
                name: data.name || null,
                last_seen_at: db.fn.now(),
            })
            .returning("*");

        return scanner;
    }

    /**
     * Получить сканер по scanner_id
     */
    async getByScannerId(scannerId: string): Promise<Scanner | null> {
        const scanner = await db(this.table).where({ scanner_id: scannerId }).first();
        return scanner || null;
    }

    /**
     * Получить сканер по id
     */
    async getById(id: number): Promise<Scanner | null> {
        const scanner = await db(this.table).where({ id }).first();
        return scanner || null;
    }

    /**
     * Получить все сканеры проекта
     */
    async getByProjectId(projectId: number): Promise<Scanner[]> {
        return db(this.table)
            .where({ project_id: projectId })
            .orderBy("created_at", "desc");
    }

    /**
     * Получить все сканеры зоны
     */
    async getByZoneId(zoneId: number): Promise<Scanner[]> {
        return db(this.table)
            .where({ zone_id: zoneId })
            .orderBy("created_at", "desc");
    }

    /**
     * Получить все сканеры зоны с количеством логов для этой зоны
     * Включает:
     * - Сканеры, прикреплённые к зоне (zone_id === zoneId)
     * - Сканеры, имеющие логи для этой зоны (могут быть сейчас на другой зоне)
     * Считает только логи для указанной зоны
     */
    async getByZoneIdWithLogsCount(
        zoneId: number
    ): Promise<(Scanner & { logsCount: number })[]> {
        const tableName = this.table;
        const results = await db(this.table)
            .select(
                `${this.table}.*`,
                db.raw("COALESCE(COUNT(scanner_logs.id), 0)::int as logs_count")
            )
            .leftJoin("scanner_logs", function() {
                this.on(`${tableName}.id`, "scanner_logs.scanner_id")
                    .andOn("scanner_logs.zone_id", db.raw("?", [zoneId]));
            })
            .where(function() {
                // Сканер прикреплён к этой зоне ИЛИ имеет логи для неё
                this.where(`${tableName}.zone_id`, zoneId)
                    .orWhereExists(function() {
                        this.select(db.raw("1"))
                            .from("scanner_logs as sl")
                            .whereRaw(`sl.scanner_id = ${tableName}.id`)
                            .andWhere("sl.zone_id", zoneId);
                    });
            })
            .groupBy(`${this.table}.id`)
            .orderBy("logs_count", "desc");

        return results.map((r: any) => ({
            ...r,
            logsCount: r.logs_count,
        }));
    }

    /**
     * Обновить last_seen_at
     */
    async updateLastSeen(id: number): Promise<void> {
        await db(this.table)
            .where({ id })
            .update({ last_seen_at: db.fn.now() });
    }

    /**
     * Удалить сканер
     */
    async delete(id: number): Promise<boolean> {
        const count = await db(this.table).where({ id }).del();
        return count > 0;
    }
}

/**
 * DAL для логов сканера
 */
export class ScannerLogsDAL {
    private readonly table = "scanner_logs";

    /**
     * Проверить существует ли хеш
     */
    async hashExists(hash: string): Promise<boolean> {
        const row = await db(this.table).where({ hash }).first();
        return !!row;
    }

    /**
     * Создать лог (если хеш не существует)
     */
    async create(data: CreateScannerLogDTO): Promise<ScannerLog | null> {
        // Проверяем дубликат
        const exists = await this.hashExists(data.hash);
        if (exists) {
            return null; // Пропускаем дубликат
        }

        const [log] = await db(this.table)
            .insert({
                project_id: data.projectId,
                zone_id: data.zoneId,
                scanner_id: data.scannerId || null,
                user_code: data.userCode,
                timestamp: new Date(data.timestamp),
                direction: data.direction,
                hash: data.hash,
            })
            .returning("*");

        return log;
    }

    /**
     * Массовая вставка логов (с пропуском дубликатов и невалидных записей)
     */
    async bulkCreate(logs: CreateScannerLogDTO[]): Promise<{ inserted: number; skipped: number; errors: number }> {
        let inserted = 0;
        let skipped = 0;
        let errors = 0;

        for (const log of logs) {
            try {
                const result = await this.create(log);
                if (result) {
                    inserted++;
                } else {
                    skipped++;
                }
            } catch (err) {
                // Пропускаем записи с ошибками (невалидный zone_id, и т.д.)
                console.warn(`[ScannerLogsDAL] Ошибка вставки лога: ${(err as Error).message}`, {
                    userCode: log.userCode,
                    zoneId: log.zoneId,
                });
                errors++;
            }
        }

        return { inserted, skipped, errors };
    }

    /**
     * Получить логи по проекту
     */
    async getByProjectId(projectId: number, limit = 100, offset = 0): Promise<ScannerLog[]> {
        return db(this.table)
            .where({ project_id: projectId })
            .orderBy("timestamp", "desc")
            .limit(limit)
            .offset(offset);
    }

    /**
     * Получить логи по зоне
     */
    async getByZoneId(zoneId: number, limit = 100, offset = 0): Promise<ScannerLog[]> {
        return db(this.table)
            .where({ zone_id: zoneId })
            .orderBy("timestamp", "desc")
            .limit(limit)
            .offset(offset);
    }

    /**
     * Получить логи по коду участника
     */
    async getByUserCode(projectId: number, userCode: string): Promise<ScannerLog[]> {
        return db(this.table)
            .where({ project_id: projectId, user_code: userCode })
            .orderBy("timestamp", "desc");
    }

    /**
     * Статистика по зоне - уникальные пользователи
     */
    async getZoneStats(zoneId: number): Promise<{ in: number; out: number; total: number }> {
        const result = await db(this.table)
            .where({ zone_id: zoneId })
            .select(
                db.raw("COUNT(DISTINCT CASE WHEN direction = 'in' THEN user_code END) as in_count"),
                db.raw("COUNT(DISTINCT CASE WHEN direction = 'out' THEN user_code END) as out_count"),
                db.raw("COUNT(DISTINCT user_code) as total")
            )
            .first();

        return {
            in: parseInt(result?.in_count || '0', 10),
            out: parseInt(result?.out_count || '0', 10),
            total: parseInt(result?.total || '0', 10),
        };
    }

    /**
     * Получить общее число уникальных пользователей по зоне с фильтрацией по дате
     */
    async getUniqueUserCountByZone(
        zoneId: number,
        dateStart?: string,
        dateEnd?: string
    ): Promise<number> {
        let query = db(this.table)
            .where({ zone_id: zoneId });

        if (dateStart) {
            query = query.where('timestamp', '>=', new Date(dateStart));
        }
        if (dateEnd) {
            const endDate = new Date(dateEnd);
            endDate.setHours(23, 59, 59, 999);
            query = query.where('timestamp', '<=', endDate);
        }

        const result = await query
            .countDistinct('user_code as count')
            .first();

        return parseInt((result as any)?.count || '0', 10);
    }

    /**
     * Удалить все логи сканеров по проекту
     */
    async deleteAllByProject(projectId: number): Promise<number> {
        const result = await db(this.table)
            .where({ project_id: projectId })
            .del();
        return result;
    }

    /**
     * Получить логи для экспорта с фильтрацией
     */
    async getLogsForExport(params: {
        projectId: number;
        zoneIds?: number[];
        timeStart?: Date;
        timeEnd?: Date;
    }): Promise<ScannerLog[]> {
        let query = db(this.table)
            .where({ project_id: params.projectId })
            .orderBy("timestamp", "asc");

        if (params.zoneIds && params.zoneIds.length > 0) {
            query = query.whereIn("zone_id", params.zoneIds);
        }

        if (params.timeStart) {
            query = query.where("timestamp", ">=", params.timeStart);
        }

        if (params.timeEnd) {
            query = query.where("timestamp", "<=", params.timeEnd);
        }

        return query;
    }
}

// Экспорт синглтонов
export const projectAuthDAL = new ProjectAuthDAL();
export const scannersDAL = new ScannersDAL();
export const scannerLogsDAL = new ScannerLogsDAL();
