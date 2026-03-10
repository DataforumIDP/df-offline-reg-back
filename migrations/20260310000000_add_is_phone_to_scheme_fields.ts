import type { Knex } from "knex";

/**
 * Добавляет поле isPhone в config JSONB для project_fields.
 * isPhone — флаг для текстовых полей, указывающий что поле содержит номер телефона.
 * При редактировании участника будет использоваться специальный инпут для телефона.
 */
export async function up(knex: Knex): Promise<void> {
    // Добавляем isPhone: false в config всех текстовых полей, где его ещё нет
    await knex.raw(`
        UPDATE project_fields
        SET config = config || '{"isPhone": false}'::jsonb
        WHERE config->>'type' = 'text' AND config->>'isPhone' IS NULL
    `);
}

export async function down(knex: Knex): Promise<void> {
    // Удаляем isPhone из config
    await knex.raw(`
        UPDATE project_fields
        SET config = config - 'isPhone'
    `);
}
