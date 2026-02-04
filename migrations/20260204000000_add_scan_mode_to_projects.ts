import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        // Режим сканирования: base (быстрый), direction (с направлением), view (просмотр)
        table.string('scan_mode', 20).notNullable().defaultTo('base');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('scan_mode');
    });
}
