import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('accounts', (table) => {
    table.increments('id').primary();
    table.string('login', 128).notNullable().unique();
    table.string('password', 256).notNullable();
    table.string('name', 256).defaultTo('Новый пользователь');
    table.string('role', 256).notNullable().defaultTo('operator');
    table.boolean('is_delete').notNullable().defaultTo(false);
    table.timestamps(true, true); // created_at, updated_at

    // Индексы для быстрого поиска
    table.index(['login', 'is_delete']);
    table.index('role');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('accounts');
}
