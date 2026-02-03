import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        // Поле для указания ключевого поля (список) для проверки доступа в зоны
        table.string('rules_field', 128).nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('projects', (table) => {
        table.dropColumn('rules_field');
    });
}
