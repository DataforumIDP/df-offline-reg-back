import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Таблица шаблонов печати
    await knex.schema.createTable("print_templates", (table) => {
        table.increments("id").primary();
        table.string("name", 1000).notNullable();
        table.jsonb("settings").notNullable().defaultTo("{}");
        table.text("preloader").nullable();
        table.boolean("is_delete").notNullable().defaultTo(false);
        table.timestamps(true, true);
    });

    // Таблица связей проект-шаблон
    await knex.schema.createTable("project_print_templates", (table) => {
        table
            .integer("project_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("projects")
            .onDelete("CASCADE");
        table
            .integer("template_id")
            .unsigned()
            .notNullable()
            .references("id")
            .inTable("print_templates")
            .onDelete("CASCADE");
        table.timestamps(true, true);

        // Один шаблон на проект
        table.primary(["project_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("project_print_templates");
    await knex.schema.dropTableIfExists("print_templates");
}
