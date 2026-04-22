import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        // Действие при считывании QR: null = нет, { type: 'print' }, { type: 'change', fieldKey, value }
        table.jsonb('scan_action').nullable().defaultTo(null);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('scan_action');
    });
}
