import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("webhooks", (table) => {
        table.increments("id").primary();
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table.string("slug", 100).notNullable().unique();
        table.string("name", 1000).notNullable();
        table.boolean("is_active").notNullable().defaultTo(true);
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.index("project_id");
        table.index("slug");
        table.index("is_active");
    });

    // Таблица для логирования запросов к webhook
    await knex.schema.createTable("webhook_logs", (table) => {
        table.increments("id").primary();
        table
            .integer("webhook_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("webhooks")
            .onDelete("CASCADE");
        table.jsonb("request_body").nullable();
        table.jsonb("request_headers").nullable();
        table.integer("response_status").nullable();
        table.jsonb("response_body").nullable();
        table.string("error_message", 2000).nullable();
        table.string("ip_address", 45).nullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index("webhook_id");
        table.index("created_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("webhook_logs");
    await knex.schema.dropTableIfExists("webhooks");
}
