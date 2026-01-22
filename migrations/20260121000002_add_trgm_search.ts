import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Включаем расширение pg_trgm для поиска по триграммам (нечёткий поиск)
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm');

    // GIN индекс для триграммного поиска по JSON данным
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS participants_data_trgm_idx 
        ON participants 
        USING GIN ((data::text) gin_trgm_ops)
    `);

    // Индекс для поиска только по цифрам (для телефонов)
    // Создаём функцию для извлечения только цифр
    await knex.raw(`
        CREATE OR REPLACE FUNCTION extract_digits(text) RETURNS text AS $$
            SELECT regexp_replace($1, '[^0-9]', '', 'g');
        $$ LANGUAGE SQL IMMUTABLE;
    `);
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw('DROP INDEX IF EXISTS participants_data_trgm_idx');
    await knex.raw('DROP FUNCTION IF EXISTS extract_digits(text)');
    // Не удаляем расширение pg_trgm, оно может использоваться в других местах
}
