import type { Knex } from "knex";

/**
 * Добавляет поле is_mark в config JSONB для project_fields.
 * isMark — флаг для чекбоксов, позволяющий помечать участников через сканер.
 * Одновременно только одно поле в проекте может иметь isMark: true.
 */
export async function up(knex: Knex): Promise<void> {
    // Добавляем isMark: false в config всех полей, где его ещё нет
    await knex.raw(`
        UPDATE project_fields
        SET config = config || '{"isMark": false}'::jsonb
        WHERE config->>'isMark' IS NULL
    `);
}

export async function down(knex: Knex): Promise<void> {
    // Удаляем isMark из config
    await knex.raw(`
        UPDATE project_fields
        SET config = config - 'isMark'
    `);
}
