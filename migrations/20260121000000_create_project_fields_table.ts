import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable('project_fields', (table) => {
        table.increments('id').primary();
        table.integer('project_id').unsigned().notNullable()
            .references('id').inTable('projects').onDelete('CASCADE');
        table.string('label', 1000).notNullable();
        table.string('key', 1000).notNullable();
        table.jsonb('config').notNullable();
        table.boolean('is_delete').defaultTo(false);
        table.timestamps(true, true);

        // Уникальный индекс: label + project_id (только для не удалённых)
        table.unique(['project_id', 'label'], { 
            indexName: 'project_fields_project_id_label_unique',
            predicate: knex.whereRaw('is_delete = false')
        });
        
        // Уникальный индекс: key + project_id (только для не удалённых)
        table.unique(['project_id', 'key'], { 
            indexName: 'project_fields_project_id_key_unique',
            predicate: knex.whereRaw('is_delete = false')
        });

        // Индексы для поиска
        table.index('project_id');
        table.index('is_delete');
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('project_fields');
}
