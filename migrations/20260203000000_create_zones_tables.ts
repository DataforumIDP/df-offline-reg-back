import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Таблица зон
    await knex.schema.createTable('zones', (table) => {
        table.increments('id').primary();
        table.integer('project_id').unsigned().notNullable()
            .references('id').inTable('projects').onDelete('CASCADE');
        table.string('name', 1000).notNullable();
        table.boolean('free').defaultTo(true); // Свободный вход (доступно всем)
        table.timestamps(true, true);

        // Индексы
        table.index('project_id');
    });

    // Таблица правил доступа к зонам
    await knex.schema.createTable('zone_rules', (table) => {
        table.increments('id').primary();
        table.integer('zone_id').unsigned().notNullable()
            .references('id').inTable('zones').onDelete('CASCADE');
        table.string('list_item', 255).notNullable(); // Значение из списка (например, VIP, NORMAL и т.д.)
        table.timestamps(true, true);

        // Уникальный индекс на пару zone_id + list_item
        table.unique(['zone_id', 'list_item']);
        table.index('zone_id');
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('zone_rules');
    await knex.schema.dropTableIfExists('zones');
}
