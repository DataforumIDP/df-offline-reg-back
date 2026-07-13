import { Knex } from "knex";

/**
 * Проблема: глобальный поиск участников строился на выражениях
 * `data::text ILIKE ...` и `EXISTS (SELECT 1 FROM jsonb_each_text(data) ...)`.
 * Ни то, ни другое не может использовать индекс:
 *  - GIN-индекс по `(data::text)` бесполезен для triграммного оператора `%`,
 *    применяемого к отдельным значениям jsonb (jsonb_each_text), т.к. индекс
 *    построен на всём JSON-тексте целиком, а не на значениях полей.
 *  - Поэтому на каждый поисковый запрос PostgreSQL был вынужден делать
 *    Seq Scan по всем участникам проекта и разворачивать jsonb_each_text
 *    на каждой строке (15 полей x 50 000 строк = 750 000+ операций на одно
 *    поисковое слово).
 *
 * Решение: добавляем два обычных text-столбца, которые всегда содержат
 * "плоское" представление данных участника:
 *  - search_text   — конкатенация всех значений data в нижнем регистре
 *  - search_digits — только цифры из search_text (для поиска по телефону)
 *
 * Оба столбца поддерживаются в актуальном состоянии триггером на INSERT/UPDATE,
 * поэтому изменений в коде создания/обновления участников не требуется.
 * На них строятся GIN-индексы gin_trgm_ops, которые уже умеют ускорять как
 * ILIKE '%...%', так и триграммный оператор `%`.
 */
export async function up(knex: Knex): Promise<void> {
    await knex.raw(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS search_text text`);
    await knex.raw(`ALTER TABLE participants ADD COLUMN IF NOT EXISTS search_digits text`);

    await knex.raw(`
        CREATE OR REPLACE FUNCTION participants_sync_search_columns() RETURNS trigger AS $$
        BEGIN
            NEW.search_text := lower(COALESCE(
                (SELECT string_agg(value, ' ') FROM jsonb_each_text(NEW.data)),
                ''
            ));
            NEW.search_digits := regexp_replace(NEW.search_text, '[^0-9]', '', 'g');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    `);

    await knex.raw(`DROP TRIGGER IF EXISTS trg_participants_sync_search_columns ON participants`);
    await knex.raw(`
        CREATE TRIGGER trg_participants_sync_search_columns
        BEFORE INSERT OR UPDATE OF data ON participants
        FOR EACH ROW EXECUTE FUNCTION participants_sync_search_columns();
    `);

    // Backfill существующих записей
    await knex.raw(`
        UPDATE participants
        SET search_text = lower(COALESCE((SELECT string_agg(value, ' ') FROM jsonb_each_text(data)), ''))
    `);
    await knex.raw(`
        UPDATE participants
        SET search_digits = regexp_replace(search_text, '[^0-9]', '', 'g')
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS participants_search_text_trgm_idx
        ON participants USING GIN (search_text gin_trgm_ops)
    `);
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS participants_search_digits_trgm_idx
        ON participants USING GIN (search_digits gin_trgm_ops)
    `);

    // Старый индекс по (data::text) больше не используется поиском
    // (не мог ускорять поиск по отдельным jsonb-значениям) - убираем,
    // чтобы не платить за его поддержку при вставке/обновлении участников.
    await knex.raw(`DROP INDEX IF EXISTS participants_data_trgm_idx`);
}

export async function down(knex: Knex): Promise<void> {
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS participants_data_trgm_idx
        ON participants USING GIN ((data::text) gin_trgm_ops)
    `);

    await knex.raw(`DROP INDEX IF EXISTS participants_search_digits_trgm_idx`);
    await knex.raw(`DROP INDEX IF EXISTS participants_search_text_trgm_idx`);
    await knex.raw(`DROP TRIGGER IF EXISTS trg_participants_sync_search_columns ON participants`);
    await knex.raw(`DROP FUNCTION IF EXISTS participants_sync_search_columns()`);
    await knex.raw(`ALTER TABLE participants DROP COLUMN IF EXISTS search_digits`);
    await knex.raw(`ALTER TABLE participants DROP COLUMN IF EXISTS search_text`);
}
