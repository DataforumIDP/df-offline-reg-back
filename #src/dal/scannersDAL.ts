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
     * Получить все сканеры зоны с количеством логов
     */
    async getByZoneIdWithLogsCount(
        zoneId: number
    ): Promise<(Scanner & { logsCount: number })[]> {
        const results = await db(this.table)
            .select(
                `${this.table}.*`,
                db.raw("COALESCE(COUNT(scanner_logs.id), 0)::int as logs_count")
            )
            .leftJoin("scanner_logs", `${this.table}.id`, "scanner_logs.scanner_id")
            .where(`${this.table}.zone_id`, zoneId)
            .groupBy(`${this.table}.id`)
            .orderBy(`${this.table}.created_at`, "desc");

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
     * Массовая вставка логов (с пропуском дубликатов)
     */
    async bulkCreate(logs: CreateScannerLogDTO[]): Promise<{ inserted: number; skipped: number }> {
        let inserted = 0;
        let skipped = 0;

        for (const log of logs) {
            const result = await this.create(log);
            if (result) {
                inserted++;
            } else {
                skipped++;
            }
        }

        return { inserted, skipped };
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
     * Статистика по зоне
     */
    async getZoneStats(zoneId: number): Promise<{ in: number; out: number; total: number }> {
        const result = await db(this.table)
            .where({ zone_id: zoneId })
            .select(
                db.raw("COUNT(*) FILTER (WHERE direction = 'in') as in_count"),
                db.raw("COUNT(*) FILTER (WHERE direction = 'out') as out_count"),
                db.raw("COUNT(*) as total")
            )
            .first();

        return {
            in: parseInt(result?.in_count || '0', 10),
            out: parseInt(result?.out_count || '0', 10),
            total: parseInt(result?.total || '0', 10),
        };
    }
}

// Экспорт синглтонов
export const projectAuthDAL = new ProjectAuthDAL();
export const scannersDAL = new ScannersDAL();
export const scannerLogsDAL = new ScannerLogsDAL();
