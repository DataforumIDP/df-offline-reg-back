import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("scanners", (table) => {
        table.boolean("is_checked_out").notNullable().defaultTo(false);
        table.timestamp("checked_out_at").nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("scanners", (table) => {
        table.dropColumn("is_checked_out");
        table.dropColumn("checked_out_at");
    });
}
