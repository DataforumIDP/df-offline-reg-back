import { Response } from 'express'
import { db } from '../config/db'
import { dbError } from '../utils/errors'
import { wrap } from '../utils/wrap'
import { ReqWithBody, ReqWithParams } from '../baseTypes'
import { runScript } from '../utils/scriptRunner'

export class ProjectScriptsService {
    private async finishRuntimeRun(
        runId: number,
        status: 'succeeded' | 'failed',
        result: Record<string, unknown>,
        logs: Array<{ participantId: number; text: string }>
    ): Promise<boolean> {
        const [, err] = await wrap(
            db('runtime_script_runs').where({ id: runId }).update({
                status,
                result: JSON.stringify(result),
                log: JSON.stringify(logs),
                completed_at: db.fn.now(),
            })
        )
        if (err) {
            console.error(`[runtime-script] failed to finalize run #${runId}`, err)
        }
        return !err
    }

    async get(req: ReqWithParams<{ projectId: string }>, res: Response) {
        const projectId = Number(req.params.projectId)

        const [row, err] = await wrap(
            db('projects')
                .where({ id: projectId })
                .first('pre_script', 'post_script', 'runtime_script')
        )

        if (err) return dbError(res, '#SCRIPTS_GET1')

        res.json({
            preScript: row?.pre_script ?? null,
            postScript: row?.post_script ?? null,
            runtimeScript: row?.runtime_script ?? null,
        })
    }

    async update(
        req: ReqWithParams<{ projectId: string }> &
            ReqWithBody<{
                preScript?: string | null
                postScript?: string | null
                runtimeScript?: string | null
            }>,
        res: Response
    ) {
        const projectId = Number(req.params.projectId)
        const { preScript, postScript, runtimeScript } = req.body

        if (
            preScript !== undefined &&
            preScript !== null &&
            typeof preScript !== 'string'
        ) {
            return res.status(400).json({
                errors: {
                    preScript: 'preScript должен быть строкой или null',
                },
            })
        }
        if (
            postScript !== undefined &&
            postScript !== null &&
            typeof postScript !== 'string'
        ) {
            return res.status(400).json({
                errors: {
                    postScript: 'postScript должен быть строкой или null',
                },
            })
        }
        if (
            runtimeScript !== undefined &&
            runtimeScript !== null &&
            typeof runtimeScript !== 'string'
        ) {
            return res.status(400).json({
                errors: {
                    runtimeScript: 'runtimeScript должен быть строкой или null',
                },
            })
        }

        const [, updateErr] = await wrap(
            db('projects')
                .where({ id: projectId })
                .update({
                    pre_script: preScript ?? null,
                    post_script: postScript ?? null,
                    runtime_script: runtimeScript ?? null,
                    updated_at: db.fn.now(),
                })
        )

        if (updateErr) return dbError(res, '#SCRIPTS_UPD1')

        const [row, err] = await wrap(
            db('projects')
                .where({ id: projectId })
                .first('pre_script', 'post_script', 'runtime_script')
        )

        if (err) return dbError(res, '#SCRIPTS_UPD2')

        res.json({
            preScript: row?.pre_script ?? null,
            postScript: row?.post_script ?? null,
            runtimeScript: row?.runtime_script ?? null,
        })
    }

    async runRuntime(req: ReqWithParams<{ projectId: string }>, res: Response) {
        const projectId = Number(req.params.projectId)
        const [project, projectErr] = await wrap(
            db('projects').where({ id: projectId }).first('runtime_script')
        )
        if (projectErr) return dbError(res, '#SCRIPTS_RUNTIME1')
        if (!project?.runtime_script?.trim()) {
            return res
                .status(400)
                .json({ success: false, error: 'Runtime-скрипт не настроен' })
        }

        const [runRows, runErr] = await wrap(
            db('runtime_script_runs')
                .insert({
                    project_id: projectId,
                    script_code: project.runtime_script,
                    status: 'running',
                    log: JSON.stringify([]),
                })
                .returning('id')
        )
        if (runErr) return dbError(res, '#SCRIPTS_RUNTIME_RUN1')
        const runId = Number(runRows?.[0]?.id)
        if (!Number.isInteger(runId) || runId <= 0) {
            return dbError(res, '#SCRIPTS_RUNTIME_RUN2')
        }

        const logs: Array<{ participantId: number; text: string }> = []

        const [participants, participantsErr] = await wrap(
            db('participants')
                .select('id', 'data')
                .where({ project_id: projectId, is_delete: false })
                .orderBy('id', 'asc')
        )
        if (participantsErr) {
            const result = {
                success: false,
                processed: 0,
                updated: 0,
                error: 'Не удалось загрузить участников проекта',
            }
            if (!(await this.finishRuntimeRun(runId, 'failed', result, logs))) {
                return dbError(res, '#SCRIPTS_RUNTIME_RUN3')
            }
            return dbError(res, '#SCRIPTS_RUNTIME2')
        }

        const [codeFields, codeFieldsErr] = await wrap(
            db('project_fields')
                .select('key', 'config')
                .where({ project_id: projectId, is_delete: false })
        )
        if (codeFieldsErr) {
            const result = {
                success: false,
                processed: 0,
                updated: 0,
                error: 'Не удалось загрузить поля кодов проекта',
            }
            if (!(await this.finishRuntimeRun(runId, 'failed', result, logs))) {
                return dbError(res, '#SCRIPTS_RUNTIME_RUN4')
            }
            return dbError(res, '#SCRIPTS_RUNTIME5')
        }

        const codeKeys = (codeFields ?? [])
            .filter((field) => field.config?.type === 'code')
            .map((field) => field.key)
        const participantCodes = new Map<string, Set<number>>()
        for (const participant of participants ?? []) {
            for (const key of codeKeys) {
                const code = participant.data?.[key]
                if (code !== undefined && code !== null && String(code) !== '') {
                    const matchingIds = participantCodes.get(String(code)) ?? new Set<number>()
                    matchingIds.add(participant.id)
                    participantCodes.set(String(code), matchingIds)
                }
            }
        }

        const scansByParticipant = new Map<
            number,
            Array<{ zone: string; timestamp: string }>
        >()
        if (participantCodes.size > 0) {
            const [scanRows, scansErr] = await wrap(
                db('scanner_logs')
                    .leftJoin('zones', 'scanner_logs.zone_id', 'zones.id')
                    .select(
                        'scanner_logs.user_code',
                        'scanner_logs.timestamp',
                        'zones.name as zone'
                    )
                    .where('scanner_logs.project_id', projectId)
                    .whereIn('scanner_logs.user_code', [...participantCodes.keys()])
                    .orderBy('scanner_logs.timestamp', 'asc')
            )
            if (scansErr) {
                const result = {
                    success: false,
                    processed: 0,
                    updated: 0,
                    error: 'Не удалось загрузить события сканирования',
                }
                if (!(await this.finishRuntimeRun(runId, 'failed', result, logs))) {
                    return dbError(res, '#SCRIPTS_RUNTIME_RUN5')
                }
                return dbError(res, '#SCRIPTS_RUNTIME6')
            }

            for (const scan of scanRows ?? []) {
                const participantIds = participantCodes.get(String(scan.user_code))
                if (!participantIds) continue
                const event = {
                    zone: String(scan.zone ?? ''),
                    timestamp:
                        scan.timestamp instanceof Date
                            ? scan.timestamp.toISOString()
                            : String(scan.timestamp),
                }
                for (const participantId of participantIds) {
                    const participantScans = scansByParticipant.get(participantId) ?? []
                    participantScans.push(event)
                    scansByParticipant.set(participantId, participantScans)
                }
            }
        }

        const transformed: Array<{
            id: number
            originalData: Record<string, any>
            data: Record<string, any>
        }> = []
        for (const participant of participants ?? []) {
            try {
                const data = await runScript(
                    project.runtime_script,
                    {
                        user: participant.data,
                        scans: scansByParticipant.get(participant.id) ?? [],
                    },
                    'runtime',
                    async (text) => {
                        const entry = { participantId: participant.id, text }
                        const [updated, logErr] = await wrap(
                            db('runtime_script_runs')
                                .where({ id: runId })
                                .update({
                                    log: db.raw('?? || ?::jsonb', [
                                        'log',
                                        JSON.stringify([entry]),
                                    ]),
                                })
                        )
                        if (logErr || !updated) {
                            throw new Error(
                                'Не удалось сохранить сообщение runtime-лога'
                            )
                        }
                        logs.push(entry)
                    }
                )
                transformed.push({
                    id: participant.id,
                    originalData: participant.data,
                    data,
                })
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error)
                const result = {
                    success: false,
                    processed: transformed.length,
                    updated: 0,
                    participantId: participant.id,
                    error: message,
                }
                if (!(await this.finishRuntimeRun(runId, 'failed', result, logs))) {
                    return dbError(res, '#SCRIPTS_RUNTIME_RUN6')
                }
                return res.status(400).json({
                    success: false,
                    error: `Runtime-скрипт завершился с ошибкой на участнике #${participant.id}: ${message}`,
                    participantId: participant.id,
                    runId,
                })
            }
        }

        const changed = transformed.filter(
            (participant) =>
                JSON.stringify(participant.originalData) !==
                JSON.stringify(participant.data)
        )
        const result = {
            success: true,
            processed: transformed.length,
            updated: changed.length,
        }

        let hasConflict = false
        try {
            await db.transaction(async (trx) => {
                for (const participant of changed) {
                    const updated = await trx('participants')
                        .where({
                            id: participant.id,
                            project_id: projectId,
                            is_delete: false,
                        })
                        .whereRaw('data = ?::jsonb', [
                            JSON.stringify(participant.originalData),
                        ])
                        .update({
                            data: JSON.stringify(participant.data),
                            updated_at: trx.fn.now(),
                        })

                    if (updated !== 1) {
                        hasConflict = true
                        throw new Error(
                            `Данные участника #${participant.id} изменились во время выполнения. Запуск отменён, изменения не сохранены.`
                        )
                    }
                }

                const runUpdated = await trx('runtime_script_runs')
                    .where({ id: runId, project_id: projectId })
                    .update({
                        status: 'succeeded',
                        result: JSON.stringify(result),
                        log: JSON.stringify(logs),
                        completed_at: trx.fn.now(),
                    })
                if (runUpdated !== 1) {
                    throw new Error('Не удалось сохранить результат запуска')
                }
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            const failedResult = {
                success: false,
                processed: transformed.length,
                updated: 0,
                error: message,
            }
            if (
                !(await this.finishRuntimeRun(
                    runId,
                    'failed',
                    failedResult,
                    logs
                ))
            ) {
                return dbError(res, '#SCRIPTS_RUNTIME_RUN7')
            }
            if (hasConflict) {
                return res
                    .status(409)
                    .json({ success: false, error: message, runId })
            }
            return dbError(res, '#SCRIPTS_RUNTIME3')
        }

        res.json({
            ...result,
            runId,
        })
    }

    async getRuntimeRuns(req: ReqWithParams<{ projectId: string }>, res: Response) {
        const projectId = Number(req.params.projectId)
        const rawSearch = req.query.search
        const search = typeof rawSearch === 'string' ? rawSearch.trim().slice(0, 200) : ''
        const query = db('runtime_script_runs')
            .select(
                'id',
                'status',
                'result',
                'log',
                'started_at as startedAt',
                'completed_at as completedAt'
            )
            .where({ project_id: projectId })
            .orderBy('started_at', 'desc')
            .limit(100)

        if (search) {
            const escapedSearch = search.replace(/[\\%_]/g, '\\$&')
            query.whereRaw('log::text ILIKE ?', [`%${escapedSearch}%`])
        }

        const [runs, err] = await wrap(query)
        if (err) return dbError(res, '#SCRIPTS_RUNTIME_LOGS1')

        res.json(
            (runs ?? []).map((run) => ({
                id: run.id,
                status: run.status,
                result: run.result,
                logs: Array.isArray(run.log)
                    ? run.log.filter(
                          (entry: unknown) =>
                              typeof entry === 'object' &&
                              entry !== null &&
                              typeof (entry as { participantId?: unknown })
                                  .participantId === 'number' &&
                              typeof (entry as { text?: unknown }).text ===
                                  'string'
                      )
                    : [],
                startedAt:
                    run.startedAt instanceof Date
                        ? run.startedAt.toISOString()
                        : String(run.startedAt),
                completedAt:
                    run.completedAt instanceof Date
                        ? run.completedAt.toISOString()
                        : run.completedAt
                          ? String(run.completedAt)
                          : null,
            }))
        )
    }

    async clearRuntimeRuns(
        req: ReqWithParams<{ projectId: string }>,
        res: Response
    ) {
        const projectId = Number(req.params.projectId)
        const [deletedRows, deleteErr] = await wrap(
            db('runtime_script_runs')
                .where({ project_id: projectId })
                .delete()
                .returning('id')
        )
        if (deleteErr) return dbError(res, '#SCRIPTS_RUNTIME_CLEAR1')

        res.json({ success: true, deleted: deletedRows?.length ?? 0 })
    }
}

export const projectScriptsService = new ProjectScriptsService()
