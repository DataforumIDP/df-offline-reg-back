import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sessions', (table) => {
    // Уникальный идентификатор устройства, генерируется на клиенте и хранится в localStorage.
    // Позволяет "переиспользовать" сессию при повторном входе с того же устройства.
    table.string('device_id', 64).nullable();
    table.index('device_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('sessions', (table) => {
    table.dropColumn('device_id');
  });
}
