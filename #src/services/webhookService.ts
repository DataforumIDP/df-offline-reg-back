import { Request, Response } from "express";
import { webhooksDAL } from "../dal/webhooksDAL";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { participantLogsDAL } from "../dal/participantLogsDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { WebhookHelper } from "../models/webhooks";
import { ParticipantHelper } from "../models/participants";
import { ProjectFieldHelper } from "../models/projectFields";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { normalizeParticipantPhones, getPhoneFieldKeys } from "../utils/phoneUtils";
import { runScript } from "../utils/scriptRunner";
import { db } from "../config/db";

const participantsDAL = new ParticipantsDAL();
const fieldsDAL = new ProjectFieldsDAL();

export class WebhookService {
    /**
     * POST /webhooks
     * Создание нового webhook
     */
    async create(req: Request, res: Response) {
        const { projectId, name, slug, isActive } = req.body;

        const [webhook, err] = await wrap(
            webhooksDAL.create({ projectId, name, slug, isActive })
        );

        if (err) {
            // Проверяем ошибку дублирования slug
            if (err.message === 'SLUG_EXISTS') {
                return res.status(400).json({ 
                    errors: { slug: 'Webhook с таким slug уже существует' } 
                });
            }
            return dbError(res, "#CREATEWEBHOOK1");
        }

        if (!webhook) {
            return dbError(res, "#CREATEWEBHOOK2");
        }

        response201(res, WebhookHelper.toJSON(webhook));
    }

    /**
     * GET /projects/:projectId/webhooks
     * Получение списка webhooks проекта
     */
    async getByProject(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        const [webhooks, err] = await wrap(webhooksDAL.getByProjectId(projectId));

        if (err) {
            return dbError(res, "#GETWEBHOOKS1");
        }

        res.json(webhooks?.map(WebhookHelper.toJSON) || []);
    }

    /**
     * GET /webhooks/:slug
     * Получение webhook по slug
     */
    async getOne(req: Request, res: Response) {
        const webhook = req.webhook!;
        res.json(WebhookHelper.toJSON(webhook));
    }

    /**
     * PUT /webhooks/:slug
     * Обновление webhook
     */
    async update(req: Request, res: Response) {
        const webhook = req.webhook!;
        const { name, isActive, preScript, postScript } = req.body;

        const [updated, err] = await wrap(
            webhooksDAL.update(webhook.id, { name, isActive, preScript, postScript })
        );

        if (err || !updated) {
            return dbError(res, "#UPDATEWEBHOOK1");
        }

        res.json(WebhookHelper.toJSON(updated));
    }

    /**
     * DELETE /webhooks/:slug
     * Удаление webhook
     */
    async delete(req: Request, res: Response) {
        const webhook = req.webhook!;

        const [deleted, err] = await wrap(webhooksDAL.delete(webhook.id));

        if (err || !deleted) {
            return dbError(res, "#DELETEWEBHOOK1");
        }

        response204(res);
    }

    /**
     * POST /webhooks/:slug
     * Публичный эндпоинт для приёма данных через webhook
     * Создаёт участника аналогично обычному созданию
     */
    async receive(req: Request, res: Response) {
        const webhook = req.webhook!;
        const rawData = req.body;
        const projectId = webhook.project_id;

        // Загружаем скрипты уровня проекта
        const projectRow = await db("projects").where({ id: projectId }).first("pre_script", "post_script");
        const projectPreScript: string | null = projectRow?.pre_script ?? null;
        const projectPostScript: string | null = projectRow?.post_script ?? null;

        // ── Прескрипт вебхука (специфичный для этого хука) ──
        let data = rawData;
        if (webhook.pre_script) {
            try {
                data = await runScript(webhook.pre_script, { user: rawData }, 'webhook');
            } catch (scriptErr: any) {
                return res.status(400).json({
                    success: false,
                    error: scriptErr?.message ?? "Ошибка прескрипта вебхука",
                });
            }
        }

        // ── Прескрипт проекта ──
        if (projectPreScript) {
            try {
                data = await runScript(projectPreScript, { user: data }, 'webhook');
            } catch (scriptErr: any) {
                return res.status(400).json({
                    success: false,
                    error: scriptErr?.message ?? "Ошибка прескрипта проекта",
                });
            }
        }

        // Получаем схему полей проекта для валидации
        const [fields, fieldsErr] = await wrap(fieldsDAL.getByProjectId(projectId));
        if (fieldsErr || !fields) {
            return dbError(res, "#WEBHOOKRECEIVE1");
        }

        // Валидируем данные по схеме
        const errors: Record<string, string> = {};
        const validatedData: Record<string, any> = {};

        for (const field of fields) {
            const value = data[field.key];
            const config = field.config;

            // Пропускаем скрытые поля — вебхук не может их устанавливать
            if ((config as any).isHidden) {
                continue;
            }

            // Генерация ID для полей типа id
            if (config.type === "id") {
                const [maxId] = await wrap(
                    participantsDAL.getMaxIdFieldValue(projectId, field.key)
                );
                validatedData[field.key] = (maxId || 0) + 1;
                continue;
            }

            // Проверка обязательных полей
            if (!config.optional && (value === undefined || value === null || value === "")) {
                errors[field.key] = `${field.label} обязательно для заполнения`;
                continue;
            }

            // Если поле пустое и необязательное - пропускаем
            if (value === undefined || value === null || value === "") {
                continue;
            }

            // Валидация по типу
            switch (config.type) {
                case "text":
                    if (typeof value !== "string" && typeof value !== "number") {
                        errors[field.key] = `${field.label}: ожидается текст`;
                    } else if (config.maxLength && String(value).length > config.maxLength) {
                        errors[field.key] = `${field.label}: максимум ${config.maxLength} символов`;
                    } else {
                        validatedData[field.key] = String(value);
                    }
                    break;

                case "bool":
                    const boolValue = String(value).toLowerCase();
                    if (!["true", "false", "1", "0", "да", "нет"].includes(boolValue)) {
                        errors[field.key] = `${field.label}: ожидается true/false`;
                    } else {
                        validatedData[field.key] = ["true", "1", "да"].includes(boolValue);
                    }
                    break;

                case "list":
                    if (config.listSettings) {
                        const allowedValues = config.listSettings.items.map((i) => i.value);
                        if (config.listSettings.multiple) {
                            const values = Array.isArray(value)
                                ? value
                                : String(value).split(",").map((v) => v.trim());
                            const invalid = values.filter((v) => !allowedValues.includes(v));
                            if (invalid.length > 0) {
                                errors[field.key] = `${field.label}: недопустимые значения: ${invalid.join(", ")}`;
                            } else {
                                validatedData[field.key] = values;
                            }
                        } else {
                            if (!allowedValues.includes(String(value))) {
                                errors[field.key] = `${field.label}: допустимые значения: ${allowedValues.join(", ")}`;
                            } else {
                                validatedData[field.key] = String(value);
                            }
                        }
                    }
                    break;

                case "img":
                    validatedData[field.key] = String(value);
                    break;

                case "code":
                    // Если значение передано - используем его
                    validatedData[field.key] = String(value);
                    break;

                default:
                    validatedData[field.key] = value;
            }

            // Проверка уникальности
            if (!errors[field.key] && config.uniq && validatedData[field.key]) {
                const [isUnique] = await wrap(
                    participantsDAL.isFieldValueUnique(projectId, field.key, validatedData[field.key])
                );
                if (!isUnique) {
                    errors[field.key] = `${field.label}: значение "${validatedData[field.key]}" уже используется`;
                }
            }
        }

        // Подставляем значения по умолчанию и генерируем случайные коды
        for (const field of fields) {
            const config = field.config as any;

            // Генерируем случайные значения для полей типа code с random: true
            if (config.type === 'code' && config.random === true) {
                if (validatedData[field.key] === undefined || validatedData[field.key] === '') {
                    validatedData[field.key] = ProjectFieldHelper.generateRandomValue(config);
                }
            }

            // Подставляем значения по умолчанию
            if (config.defaultValue !== undefined) {
                if (validatedData[field.key] === undefined || validatedData[field.key] === '') {
                    validatedData[field.key] = config.defaultValue;
                }
            }
        }

        // Если есть ошибки - возвращаем
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ success: false, errors });
        }

        // Нормализуем телефонные номера
        const phoneFieldKeys = getPhoneFieldKeys(fields as any);
        const normalizedData = normalizeParticipantPhones(validatedData, phoneFieldKeys);

        // Создаём участника
        const [participant, createErr] = await wrap(
            participantsDAL.create({
                project_id: projectId,
                data: normalizedData,
            })
        );

        if (createErr || !participant) {
            return dbError(res, "#WEBHOOKRECEIVE2");
        }

        // Записываем в лог с пометкой что создан через webhook
        await participantLogsDAL.create({
            projectId,
            participantId: participant.id,
            action: "CREATE",
            actor: "WEBHOOK",
            userId: null,
            currentData: participant.data,
        });

        // ── Постскрипт вебхука ──
        let finalData = participant.data;
        if (webhook.post_script) {
            try {
                const result = await runScript(webhook.post_script, { user: participant.data }, 'webhook');
                // Если постскрипт вернул изменения — сохраняем их
                const [updated] = await wrap(
                    participantsDAL.update(participant.id, result)
                );
                if (updated) {
                    finalData = result;
                }
            } catch (scriptErr: any) {
                // Постскрипт не должен откатывать сохранение, только логируем
                console.error(`[WEBHOOK POST_SCRIPT] webhook=${webhook.slug} error:`, scriptErr?.message);
            }
        }

        // ── Постскрипт проекта ──
        if (projectPostScript) {
            try {
                const result = await runScript(projectPostScript, { user: finalData }, 'webhook');
                const [updated] = await wrap(participantsDAL.update(participant.id, result));
                if (updated) finalData = result;
            } catch (scriptErr: any) {
                console.error(`[PROJECT POST_SCRIPT webhook] webhook=${webhook.slug} error:`, scriptErr?.message);
            }
        }

        response201(res, {
            success: true,
            participant: ParticipantHelper.toJSON({ ...participant, data: finalData }),
        });
    }

    /**
     * GET /webhooks/:slug/logs
     * Получение логов webhook
     */
    async getLogs(req: Request, res: Response) {
        const webhook = req.webhook!;
        const limit = Number(req.query.limit) || 100;

        const [logs, err] = await wrap(webhooksDAL.getLogs(webhook.id, limit));

        if (err) {
            return dbError(res, "#GETWEBHOOKLOGS1");
        }

        res.json(logs?.map(WebhookHelper.toLogJSON) || []);
    }
}

export const webhookService = new WebhookService();
