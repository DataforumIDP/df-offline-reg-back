import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("service_tokens", (table) => {
        table.increments("id").primary();
        table.string("name", 255).notNullable().comment("Название сервиса (видеоплатформа и т.д.)");
        table.string("token", 128).notNullable().unique().comment("Токен доступа (хэш)");
        table.specificType("allowed_ips", "text[]").notNullable().defaultTo("{}").comment("Разрешённые IP-адреса, пустой массив = любой");
        table.boolean("is_revoked").notNullable().defaultTo(false).comment("Отозван ли токен");
        table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
        table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("service_tokens");
}
