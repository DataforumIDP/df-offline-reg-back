import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('device_journal', (table) => {
        table.increments('id').primary();
        table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.integer('zone_id').references('id').inTable('zones').onDelete('SET NULL');
        table.integer('scanner_id').references('id').inTable('scanners').onDelete('SET NULL');
        table.string('scanner_name', 100); // Кэшируем имя сканера на момент выдачи
        table.string('zone_name', 100); // Кэшируем имя зоны на момент выдачи
        table.string('user_code', 255).notNullable(); // Код участника
        table.string('user_name', 255); // Имя участника (кэшируется)
        table.integer('participant_id').references('id').inTable('participants').onDelete('SET NULL');
        table.timestamp('checkout_at').notNullable().defaultTo(knex.fn.now()); // Время выдачи
        table.timestamp('checkin_at'); // Время сдачи (null = на руках)
        table.boolean('is_returned').notNullable().defaultTo(false); // Флаг возврата
        table.boolean('manual_return').notNullable().defaultTo(false); // Ручной возврат через админку
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        
        // Индексы для поиска
        table.index(['project_id', 'is_returned']);
        table.index(['project_id', 'checkout_at']);
        table.index(['project_id', 'user_code']);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('device_journal');
}
