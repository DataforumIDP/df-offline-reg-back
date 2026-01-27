import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Обновляем все существующие поля схемы - добавляем optional: true в config
    await knex.raw(`
        UPDATE project_fields 
        SET config = config || '{"optional": true}'::jsonb
        WHERE config->>'optional' IS NULL
    `);
}

export async function down(knex: Knex): Promise<void> {
    // Удаляем optional из config
    await knex.raw(`
        UPDATE project_fields 
        SET config = config - 'optional'
    `);
}
