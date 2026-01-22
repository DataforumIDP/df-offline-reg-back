import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('participants', (table) => {
        table.increments('id').primary();
        table.integer('project_id').unsigned().notNullable()
            .references('id').inTable('projects').onDelete('CASCADE');
        table.jsonb('data').notNullable().defaultTo('{}');
        table.boolean('is_delete').defaultTo(false);
        table.timestamps(true, true);

        // Индекс для быстрого поиска по проекту
        table.index(['project_id', 'is_delete']);
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('participants');
}
