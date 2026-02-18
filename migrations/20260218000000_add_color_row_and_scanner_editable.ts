import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Добавляем colorRow в projects
    await knex.schema.alterTable('projects', (table) => {
        table.boolean('colorRow').defaultTo(false);
    });

    // Добавляем scanner_editable в project_fields
    await knex.schema.alterTable('project_fields', (table) => {
        table.boolean('scanner_editable').defaultTo(false);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('colorRow');
    });

    await knex.schema.alterTable('project_fields', (table) => {
        table.dropColumn('scanner_editable');
    });
}
