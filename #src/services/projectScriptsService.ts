import { Response } from 'express'
import { db } from '../config/db'
import { dbError } from '../utils/errors'
import { wrap } from '../utils/wrap'
import { ReqWithBody, ReqWithParams } from '../baseTypes'
import { runScript } from '../utils/scriptRunner'

export class ProjectScriptsService {
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

        const [participants, participantsErr] = await wrap(
            db('participants')
                .select('id', 'data')
                .where({ project_id: projectId, is_delete: false })
                .orderBy('id', 'asc')
        )
        if (participantsErr) return dbError(res, '#SCRIPTS_RUNTIME2')

        const transformed: Array<{
            id: number
            originalData: Record<string, any>
            data: Record<string, any>
        }> = []
        for (const participant of participants ?? []) {
            try {
                const data = await runScript(
                    project.runtime_script,
                    { user: participant.data },
                    'runtime'
                )
                transformed.push({
                    id: participant.id,
                    originalData: participant.data,
                    data,
                })
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error)
                return res.status(400).json({
                    success: false,
                    error: `Runtime-скрипт завершился с ошибкой на участнике #${participant.id}: ${message}`,
                    participantId: participant.id,
                })
            }
        }

        const changed = transformed.filter(
            (participant) =>
                JSON.stringify(participant.originalData) !==
                JSON.stringify(participant.data)
        )

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
            })
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error)
            if (hasConflict) {
                return res.status(409).json({ success: false, error: message })
            }
            return dbError(res, '#SCRIPTS_RUNTIME3')
        }

        res.json({
            success: true,
            processed: transformed.length,
            updated: changed.length,
        })
    }
}

export const projectScriptsService = new ProjectScriptsService()
