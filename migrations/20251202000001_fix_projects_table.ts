import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Проверяем существование таблицы
    const hasTable = await knex.schema.hasTable('projects');
    
    if (hasTable) {
        // Удаляем старую таблицу если она существует
        await knex.schema.dropTable('projects');
    }
    
    // Создаем таблицу с правильными именами полей
    return knex.schema.createTable('projects', (table) => {
        table.increments('id').primary();
        table.string('title', 128).notNullable();
        table.string('slug', 128).notNullable().unique();
        table.string('description', 200).nullable();
        table.timestamp('dateStart').notNullable();
        table.timestamp('dateEnd').notNullable();
        table.boolean('isDelete').defaultTo(false);
        table.timestamps(true, true);

        // Индексы
        table.index('slug');
        table.index('dateStart');
        table.index('dateEnd');
        table.index('isDelete');
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('projects');
}
