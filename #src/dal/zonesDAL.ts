import { db } from "../config/db";
import { Zone, ZoneRule, ZoneWithRules, CreateZoneDTO, UpdateZoneDTO, CreateZoneRuleDTO } from "../models/zones";

/**
 * DAL для работы с Zones (Зонами)
 */
export class ZonesDAL {
    private readonly table = "zones";
    private readonly rulesTable = "zone_rules";

    /**
     * Создать зону
     */
    async create(data: CreateZoneDTO): Promise<Zone> {
        const [zone] = await db(this.table)
            .insert({
                project_id: data.projectId,
                name: data.name,
                free: data.free ?? true,
            })
            .returning("*");

        return zone;
    }

    /**
     * Получить зону по ID
     */
    async getById(id: number): Promise<Zone | null> {
        const zone = await db(this.table).where({ id }).first();
        return zone || null;
    }

    /**
     * Получить зону с правилами по ID
     */
    async getByIdWithRules(id: number): Promise<ZoneWithRules | null> {
        const zone = await db(this.table).where({ id }).first();
        if (!zone) return null;

        const rules = await db(this.rulesTable)
            .where({ zone_id: id })
            .orderBy("list_item", "asc");

        return { ...zone, rules };
    }

    /**
     * Получить все зоны проекта
     */
    async getByProjectId(projectId: number): Promise<Zone[]> {
        return db(this.table)
            .where({ project_id: projectId })
            .orderBy("name", "asc");
    }

    /**
     * Получить все зоны проекта с правилами
     */
    async getByProjectIdWithRules(projectId: number): Promise<ZoneWithRules[]> {
        const zones = await db(this.table)
            .where({ project_id: projectId })
            .orderBy("name", "asc");

        if (zones.length === 0) return [];

        const zoneIds = zones.map((z: Zone) => z.id);
        const rules = await db(this.rulesTable)
            .whereIn("zone_id", zoneIds)
            .orderBy("list_item", "asc");

        // Группируем правила по zone_id
        const rulesByZone = new Map<number, ZoneRule[]>();
        for (const rule of rules) {
            if (!rulesByZone.has(rule.zone_id)) {
                rulesByZone.set(rule.zone_id, []);
            }
            rulesByZone.get(rule.zone_id)!.push(rule);
        }

        return zones.map((zone: Zone) => ({
            ...zone,
            rules: rulesByZone.get(zone.id) || [],
        }));
    }

    /**
     * Обновить зону
     */
    async update(id: number, data: UpdateZoneDTO): Promise<Zone | null> {
        const updateData: Partial<Zone> & { updated_at: Date } = {
            updated_at: new Date(),
        };

        if (data.name !== undefined) {
            updateData.name = data.name;
        }
        if (data.free !== undefined) {
            updateData.free = data.free;
        }

        const [updated] = await db(this.table)
            .where({ id })
            .update(updateData)
            .returning("*");

        return updated || null;
    }

    /**
     * Удалить зону
     */
    async delete(id: number): Promise<boolean> {
        const deleted = await db(this.table).where({ id }).delete();
        return deleted > 0;
    }

    // ========== Правила доступа ==========

    /**
     * Добавить правило доступа
     */
    async createRule(data: CreateZoneRuleDTO): Promise<ZoneRule> {
        const [rule] = await db(this.rulesTable)
            .insert({
                zone_id: data.zoneId,
                list_item: data.listItem,
            })
            .returning("*");

        return rule;
    }

    /**
     * Получить правило по ID
     */
    async getRuleById(id: number): Promise<ZoneRule | null> {
        const rule = await db(this.rulesTable).where({ id }).first();
        return rule || null;
    }

    /**
     * Получить правило по zone_id и list_item
     */
    async getRuleByZoneAndItem(zoneId: number, listItem: string): Promise<ZoneRule | null> {
        const rule = await db(this.rulesTable)
            .where({ zone_id: zoneId, list_item: listItem })
            .first();
        return rule || null;
    }

    /**
     * Получить все правила зоны
     */
    async getRulesByZoneId(zoneId: number): Promise<ZoneRule[]> {
        return db(this.rulesTable)
            .where({ zone_id: zoneId })
            .orderBy("list_item", "asc");
    }

    /**
     * Удалить правило
     */
    async deleteRule(id: number): Promise<boolean> {
        const deleted = await db(this.rulesTable).where({ id }).delete();
        return deleted > 0;
    }

    /**
     * Проверить доступ к зоне для определённого значения списка
     */
    async checkAccess(zoneId: number, listItem: string): Promise<boolean> {
        const zone = await this.getById(zoneId);
        if (!zone) return false;

        // Если свободный вход - доступ разрешён
        if (zone.free) return true;

        // Проверяем правила
        const rule = await this.getRuleByZoneAndItem(zoneId, listItem);
        return !!rule;
    }

    /**
     * Получить доступные зоны для значения списка
     */
    async getAccessibleZones(projectId: number, listItem: string): Promise<Zone[]> {
        // Получаем все зоны проекта
        const zones = await this.getByProjectId(projectId);

        // Фильтруем: свободные + те, где есть правило для listItem
        const accessibleZoneIds: number[] = [];

        for (const zone of zones) {
            if (zone.free) {
                accessibleZoneIds.push(zone.id);
            } else {
                const rule = await this.getRuleByZoneAndItem(zone.id, listItem);
                if (rule) {
                    accessibleZoneIds.push(zone.id);
                }
            }
        }

        return zones.filter((z: Zone) => accessibleZoneIds.includes(z.id));
    }
}

export const zonesDAL = new ZonesDAL();
