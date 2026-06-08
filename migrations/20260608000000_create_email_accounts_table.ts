import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("email_accounts", (table) => {
        table.increments("id").primary();
        table.string("slug", 100).notNullable().unique();
        table.string("host", 255).notNullable();
        table.integer("port").notNullable().defaultTo(465);
        table.boolean("secure").notNullable().defaultTo(true);
        table.string("login", 255).notNullable();
        table.string("password", 500).notNullable();
        table.string("from_name", 255).nullable();
        table.boolean("is_delete").notNullable().defaultTo(false);
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("email_accounts");
}
