import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        // Включить журнал учёта устройств для проекта
        table.boolean('journal_enabled').notNullable().defaultTo(false);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('journal_enabled');
    });
}
