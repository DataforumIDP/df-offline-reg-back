import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Добавляем defaultValue: null во все существующие поля схемы, где оно отсутствует
    await knex.raw(`
        UPDATE project_fields
        SET config = config || '{"defaultValue": null}'::jsonb
        WHERE config->>'defaultValue' IS NULL
    `);
}

export async function down(knex: Knex): Promise<void> {
    // Удаляем defaultValue из config
    await knex.raw(`
        UPDATE project_fields
        SET config = config - 'defaultValue'
    `);
}
