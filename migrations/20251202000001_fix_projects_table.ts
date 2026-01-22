import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Проверяем существование таблицы
    const hasTable = await knex.schema.hasTable('projects');
    
    if (hasTable) {
        // Удаляем внешние ключи перед удалением таблицы
        await knex.schema.alterTable('accounts', (table) => {
            table.dropForeign(['projectId']);
        });
        
        // Удаляем старую таблицу если она существует
        await knex.schema.dropTable('projects');
    }
    
    // Создаем таблицу с правильными именами полей
    await knex.schema.createTable('projects', (table) => {
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
    
    // Пересоздаем внешний ключ
    return knex.schema.alterTable('accounts', (table) => {
        table.foreign('projectId').references('id').inTable('projects').onDelete('SET NULL');
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('projects');
}
