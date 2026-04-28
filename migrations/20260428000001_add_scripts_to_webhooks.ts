import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("webhooks", (table) => {
        table.text("pre_script").nullable().defaultTo(null);
        table.text("post_script").nullable().defaultTo(null);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("webhooks", (table) => {
        table.dropColumn("pre_script");
        table.dropColumn("post_script");
    });
}
