import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("participant_logs", (table) => {
        table.increments("id").primary();
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table
            .integer("participant_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("participants")
            .onDelete("SET NULL");
        table
            .enum("action", ["CREATE", "UPDATE", "DELETE", "PRINT"])
            .notNullable();
        table
            .enum("actor", ["USER", "WEBHOOK", "AUTO"])
            .notNullable()
            .defaultTo("USER");
        table
            .integer("user_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("accounts")
            .onDelete("SET NULL");
        table.jsonb("current_data").notNullable();
        table.timestamps(true, true);

        // Индексы для быстрого поиска
        table.index("project_id");
        table.index("participant_id");
        table.index("action");
        table.index("user_id");
        table.index("created_at");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("participant_logs");
}
