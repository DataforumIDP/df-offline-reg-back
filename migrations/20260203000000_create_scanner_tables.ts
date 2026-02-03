import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Таблица авторизации проектов (ключи для сканеров)
    await knex.schema.createTable("project_auth", (table) => {
        table.increments("id").primary();
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .unique()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table.string("access_key", 21).notNullable(); // 21 символ
        table.string("secret_key", 23).notNullable(); // 23 символа
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.index("project_id");
        table.index("access_key");
    });

    // Таблица сканеров
    await knex.schema.createTable("scanners", (table) => {
        table.increments("id").primary();
        table.string("scanner_id", 50).notNullable().unique(); // XXXXXX-timestamp
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table
            .integer("zone_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("zones")
            .onDelete("CASCADE");
        table.string("name", 128).nullable(); // Имя сканера (опционально)
        table.timestamp("last_seen_at").nullable(); // Последняя активность
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.index("project_id");
        table.index("zone_id");
        table.index("scanner_id");
    });

    // Таблица логов сканера
    await knex.schema.createTable("scanner_logs", (table) => {
        table.increments("id").primary();
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table
            .integer("zone_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("zones")
            .onDelete("CASCADE");
        table
            .integer("scanner_id")
            .unsigned()
            .nullable()
            .references("id")
            .inTable("scanners")
            .onDelete("SET NULL");
        table.string("user_code", 128).notNullable(); // Код участника
        table.timestamp("timestamp").notNullable(); // Время события от сканера
        table
            .enum("direction", ["in", "out"])
            .nullable(); // Направление: вход/выход/null
        table.string("hash", 32).notNullable().unique(); // MD5 хеш для защиты от дублей
        table.timestamp("created_at").defaultTo(knex.fn.now());

        table.index("project_id");
        table.index("zone_id");
        table.index("user_code");
        table.index("timestamp");
        table.index("hash");
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("scanner_logs");
    await knex.schema.dropTableIfExists("scanners");
    await knex.schema.dropTableIfExists("project_auth");
}
