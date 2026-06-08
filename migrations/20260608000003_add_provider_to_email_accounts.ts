import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable("email_accounts", (table) => {
        table.string("provider", 20).notNullable().defaultTo("smtp").after("slug");
        table.text("api_key").nullable().after("alias");
    });

    // Делаем SMTP-поля nullable — для rusender-аккаунтов они не нужны
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN host DROP NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN port DROP NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN secure DROP NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN login DROP NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN password DROP NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable("email_accounts", (table) => {
        table.dropColumn("provider");
        table.dropColumn("api_key");
    });

    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN host SET NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN port SET NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN secure SET NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN login SET NOT NULL`);
    await knex.raw(`ALTER TABLE email_accounts ALTER COLUMN password SET NOT NULL`);
}
