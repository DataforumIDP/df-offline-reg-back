import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("cloud_fonts", (table) => {
        table.increments("id").primary();
        table.string("name", 255).notNullable();
        table.string("normal_url", 1000).notNullable();
        table.string("bold_url", 1000).notNullable();
        table.string("italic_url", 1000).notNullable();
        table.string("bolditalic_url", 1000).notNullable();
        table.boolean("is_delete").notNullable().defaultTo(false);
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("cloud_fonts");
}
