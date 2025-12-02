import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.alterTable('accounts', (table) => {
        table.integer('projectId').unsigned().nullable();
        table.foreign('projectId').references('id').inTable('projects').onDelete('SET NULL');
        table.index('projectId');
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.alterTable('accounts', (table) => {
        table.dropForeign(['projectId']);
        table.dropColumn('projectId');
    });
}
