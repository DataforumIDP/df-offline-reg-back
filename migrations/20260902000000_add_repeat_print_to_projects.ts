import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("projects", (table) => {
        table.boolean("repeat_print_enabled").notNullable().defaultTo(false);
        table.integer("repeat_print_count").notNullable().defaultTo(1);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("projects", (table) => {
        table.dropColumn("repeat_print_count");
        table.dropColumn("repeat_print_enabled");
    });
}
