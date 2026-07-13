import { Knex } from "knex";

/**
 * Проблема: отметка участника через сканер (POST /scanner/mark/:participantId,
 * scannerService.markParticipant) обновляла participant.data напрямую и НЕ
 * писала запись в participant_logs. Статистика (participantLogsDAL.getStats /
 * getOperatorStats) считает только записи из participant_logs, поэтому все
 * отметки, сделанные сканерами, были невидимы для статистики - учитывались
 * только отметки, проставленные вручную через UI (actor = 'USER').
 *
 * Решение:
 * 1. Расширяем допустимые значения actor значением 'SCANNER'
 *    (в коде markParticipant теперь пишет лог с этим actor).
 * 2. Backfill: для уже помеченных участников (isMark-поле = true), у которых
 *    ни в одной существующей записи лога это поле ещё не зафиксировано как
 *    true (т.е. отметка была проставлена именно сканером в обход логов),
 *    создаём синтетическую запись лога actor='SCANNER', чтобы старые отметки
 *    тоже попали в статистику. Дата записи - updated_at участника (лучшее
 *    доступное приближение к моменту отметки).
 */
export async function up(knex: Knex): Promise<void> {
    // 1. Расширяем CHECK-constraint на actor, добавляя 'SCANNER'.
    // Имя constraint ищем динамически, т.к. оно генерируется Postgres/knex
    // автоматически и может отличаться в разных окружениях.
    await knex.raw(`
        DO $$
        DECLARE
            con_name text;
        BEGIN
            SELECT con.conname INTO con_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = 'participant_logs'
              AND con.contype = 'c'
              AND att.attname = 'actor';

            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE participant_logs DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    `);

    await knex.raw(`
        ALTER TABLE participant_logs
        ADD CONSTRAINT participant_logs_actor_check
        CHECK (actor IN ('USER', 'WEBHOOK', 'AUTO', 'SCANNER'))
    `);

    // 2. Backfill уже проставленных отметок, которые не попали в логи
    await knex.raw(`
        WITH mark_fields AS (
            SELECT project_id, key
            FROM project_fields
            WHERE is_delete = false
              AND config->>'type' = 'bool'
              AND (config->>'isMark')::boolean = true
        ),
        marked_participants AS (
            SELECT p.id, p.project_id, mf.key, p.data, p.updated_at
            FROM participants p
            JOIN mark_fields mf ON mf.project_id = p.project_id
            WHERE p.is_delete = false
              AND (p.data->>mf.key) = 'true'
        ),
        already_logged AS (
            SELECT DISTINCT pl.participant_id
            FROM participant_logs pl
            JOIN marked_participants mp ON mp.id = pl.participant_id
            WHERE (pl.current_data->>mp.key) = 'true'
        )
        INSERT INTO participant_logs
            (project_id, participant_id, action, actor, user_id, current_data, created_at, updated_at)
        SELECT mp.project_id, mp.id, 'UPDATE', 'SCANNER', NULL, mp.data, mp.updated_at, mp.updated_at
        FROM marked_participants mp
        WHERE mp.id NOT IN (SELECT participant_id FROM already_logged)
    `);
}

export async function down(knex: Knex): Promise<void> {
    // Откат constraint (снова допускаем только исходные значения).
    // ВНИМАНИЕ: строки backfill'а (actor='SCANNER') и любые новые записи,
    // созданные после деплоя этой миграции, оставляем как есть -
    // безопасно и однозначно отличить одно от другого невозможно,
    // а удаление данных статистики - необратимое действие.
    await knex.raw(`
        DO $$
        DECLARE
            con_name text;
        BEGIN
            SELECT con.conname INTO con_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = 'participant_logs'
              AND con.contype = 'c'
              AND att.attname = 'actor';

            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE participant_logs DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    `);

    await knex.raw(`
        ALTER TABLE participant_logs
        ADD CONSTRAINT participant_logs_actor_check
        CHECK (actor IN ('USER', 'WEBHOOK', 'AUTO')) NOT VALID
    `);
}
