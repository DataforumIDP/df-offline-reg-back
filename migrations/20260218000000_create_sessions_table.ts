import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('sessions', (table) => {
    table.increments('id').primary();
    table.integer('account_id').unsigned().notNullable()
      .references('id').inTable('accounts').onDelete('CASCADE');
    table.string('token_hash', 256).notNullable(); // хеш refresh токена для идентификации
    table.string('ip_address', 64).nullable();
    table.string('user_agent', 512).nullable();
    table.string('device_name', 256).nullable(); // Краткое описание устройства
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);

    // Индексы
    table.index(['account_id', 'is_active']);
    table.index('token_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('sessions');
}
