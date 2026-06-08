import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("email_accounts", (table) => {
        table.string("alias", 255).nullable().after("login");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("email_accounts", (table) => {
        table.dropColumn("alias");
    });
}
