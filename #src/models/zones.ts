/**
 * Модель Zone (Зона)
 */

export interface Zone {
    id: number;
    project_id: number;
    name: string;
    free: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface ZoneRule {
    id: number;
    zone_id: number;
    list_item: string;
    created_at: Date;
    updated_at: Date;
}

export interface ZoneWithRules extends Zone {
    rules: ZoneRule[];
}

export interface CreateZoneDTO {
    projectId: number;
    name: string;
    free?: boolean;
}

export interface UpdateZoneDTO {
    name?: string;
    free?: boolean;
}

export interface CreateZoneRuleDTO {
    zoneId: number;
    listItem: string;
}

/**
 * Helper для преобразования данных зоны
 */
export class ZoneHelper {
    static toJSON(zone: Zone | ZoneWithRules) {
        const result: any = {
            id: zone.id,
            projectId: zone.project_id,
            name: zone.name,
            free: zone.free,
            createdAt: zone.created_at,
            updatedAt: zone.updated_at,
        };

        // Если есть правила - добавляем
        if ('rules' in zone && zone.rules) {
            result.rules = zone.rules.map(ZoneRuleHelper.toJSON);
        }

        return result;
    }
}

/**
 * Helper для преобразования данных правила доступа
 */
export class ZoneRuleHelper {
    static toJSON(rule: ZoneRule) {
        return {
            id: rule.id,
            zoneId: rule.zone_id,
            listItem: rule.list_item,
            createdAt: rule.created_at,
        };
    }
}
