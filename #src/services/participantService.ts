import { Request, Response } from "express";
import * as Excel from "exceljs";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { participantLogsDAL } from "../dal/participantLogsDAL";
import { ProjectFieldsDAL } from "../dal/projectFieldsDAL";
import { ParticipantHelper } from "../models/participants";
import { ProjectFieldConfig } from "../models/projectFields";
import { dbError, errorSend } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { paginationResponse } from "../utils/paginationUtils";

const participantDAL = new ParticipantsDAL();
const fieldDAL = new ProjectFieldsDAL();

export class ParticipantService {
    /**
     * GET /projects/:projectId/participants
     * Получение списка участников проекта
     */
    async getAll(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        const [participants, meta] = await participantDAL.getByProjectId(projectId, req.query);

        if (!participants) {
            return dbError(res, "#GETPARTICIPANTS1");
        }

        res.json(
            paginationResponse({
                list: participants.map(ParticipantHelper.toJSON),
                all: meta.total,
                limit: req.query.limit as string,
                page: req.query.page as string,
            })
        );
    }

    /**
     * GET /projects/:projectId/participants/:participantId
     * Получение данных одного участника
     */
    async getOne(req: Request, res: Response) {
        const participant = req.participant!;
        res.json(ParticipantHelper.toJSON(participant));
    }

    /**
     * POST /projects/:projectId/participants
     * Добавление участника
     */
    async create(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const data = req.body;
        const userId = req.account?.id || null;

        const [participant, err] = await wrap(participantDAL.create({
            project_id: projectId,
            data,
        }));

        if (err || !participant) {
            return dbError(res, "#CREATEPARTICIPANT1");
        }

        // Записываем в лог
        await participantLogsDAL.create({
            projectId,
            participantId: participant.id,
            action: "CREATE",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        response201(res, ParticipantHelper.toJSON(participant));
    }

    /**
     * PUT /projects/:projectId/participants/:participantId
     * Обновление данных участника
     */
    async update(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        const data = req.body;
        const userId = req.account?.id || null;

        const [updated, err] = await wrap(participantDAL.update(participantId, data));

        if (err || !updated) {
            return dbError(res, "#UPDATEPARTICIPANT1");
        }

        // Записываем в лог с новыми данными
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "UPDATE",
            actor: "USER",
            userId,
            currentData: updated.data,
        });

        res.json(ParticipantHelper.toJSON(updated));
    }

    /**
     * DELETE /projects/:projectId/participants/:participantId
     * Удаление участника
     */
    async delete(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        const userId = req.account?.id || null;
        const participant = req.participant!;

        const [deleted, err] = await wrap(participantDAL.softDelete(participantId));

        if (err || !deleted) {
            return dbError(res, "#DELETEPARTICIPANT1");
        }

        // Записываем в лог данные на момент удаления
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "DELETE",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        response204(res);
    }

    /**
     * POST /projects/:projectId/participants/:participantId/print
     * Отметка о печати участника
     */
    async print(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const participantId = Number(req.params.participantId);
        const userId = req.account?.id || null;
        const participant = req.participant!;

        // Записываем в лог
        await participantLogsDAL.create({
            projectId,
            participantId,
            action: "PRINT",
            actor: "USER",
            userId,
            currentData: participant.data,
        });

        res.json({ success: true, message: "Print logged" });
    }

    /**
     * GET /projects/:projectId/participants/excel
     * Получение шаблона Excel с ключами полей в первой строке
     */
    async getExcelTemplate(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields) {
            return dbError(res, "#EXCELTEMPLATE1");
        }

        // Фильтруем поля типа id (они генерируются автоматически)
        const editableFields = fields.filter(f => f.config.type !== 'id');

        if (editableFields.length === 0) {
            return errorSend(res, { message: "В проекте нет редактируемых полей" });
        }

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet("Участники");

        // Первая строка - ключи полей (key)
        worksheet.columns = editableFields.map(field => ({
            header: field.key,
            key: field.key,
            width: 20,
        }));

        // Вторая строка - подсказки (label и тип)
        const hintRow: Record<string, string> = {};
        editableFields.forEach(field => {
            const typeHint = getFieldTypeHint(field.config);
            hintRow[field.key] = `${field.label} (${typeHint})`;
        });
        worksheet.addRow(hintRow);

        // Стилизация
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } };

        // Отправляем файл
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=template_project_${projectId}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * POST /projects/:projectId/participants/excel
     * Импорт участников из Excel
     */
    async importFromExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const userId = req.account?.id || null;

        // Проверяем наличие файла
        if (!req.files || !req.files.file) {
            return errorSend(res, { message: "Файл не загружен" });
        }

        const file = req.files.file;
        if (Array.isArray(file)) {
            return errorSend(res, { message: "Ожидается один файл" });
        }

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields || fields.length === 0) {
            return errorSend(res, { message: "Схема проекта не настроена" });
        }

        // Создаём карту полей
        const fieldMap = new Map(fields.map(f => [f.key, f]));
        const editableFields = fields.filter(f => f.config.type !== 'id');

        // Читаем Excel
        const workbook = new Excel.Workbook();
        await workbook.xlsx.load(file.data as any);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            return errorSend(res, { message: "Файл не содержит листов" });
        }

        // Получаем заголовки из первой строки
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = String(cell.value || '').trim();
        });

        console.log('[Excel Import Debug]', {
            rowCount: worksheet.rowCount,
            actualRowCount: worksheet.actualRowCount,
            headers,
        });

        if (headers.length === 0) {
            return errorSend(res, { message: "Первая строка должна содержать ключи полей" });
        }

        // Валидация строк
        const errors: { row: number; field: string; message: string }[] = [];
        const validRows: Record<string, any>[] = [];

        // Начинаем со строки 2 (строка 1 - заголовки)
        // Если есть строка подсказок - она будет пропущена как не содержащая данных для полей
        const startRow = 2;
        for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const rowData: Record<string, any> = {};
            let hasData = false;

            // Обрабатываем каждую ячейку
            row.eachCell({ includeEmpty: false }, (cell, colNum) => {
                const key = headers[colNum];
                if (!key) return;

                // Пропускаем строку подсказок (содержит "(")
                const cellStr = String(cell.value || '');
                if (rowNum === 2 && cellStr.includes('(') && cellStr.includes(')')) {
                    return;
                }

                let value = cell.value;
                
                // Обработка формул и объектов
                if (typeof value === 'object' && value !== null) {
                    if ('result' in value) {
                        value = (value as any).result;
                    } else if ('text' in value) {
                        value = (value as any).text;
                    }
                }

                if (value !== null && value !== undefined && value !== '') {
                    hasData = true;
                    rowData[key] = value;
                }
            });

            console.log(`[Row ${rowNum}]`, { hasData, rowData });

            // Пропускаем пустые строки
            if (!hasData) continue;

            // Валидация данных строки
            const rowErrors = validateRowData(rowData, fieldMap, rowNum);
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
                continue;
            }

            // Генерируем ID поля
            for (const field of fields) {
                if (field.config.type === 'id') {
                    const [maxId] = await wrap(participantDAL.getMaxIdFieldValue(projectId, field.key));
                    rowData[field.key] = (maxId || 0) + validRows.length + 1;
                }
            }

            // Проверка уникальности
            for (const field of fields) {
                if (field.config.uniq && rowData[field.key] !== undefined) {
                    const [isUnique] = await wrap(
                        participantDAL.isFieldValueUnique(projectId, field.key, rowData[field.key])
                    );
                    if (!isUnique) {
                        errors.push({
                            row: rowNum,
                            field: field.key,
                            message: `Значение "${rowData[field.key]}" уже используется`,
                        });
                    }
                }
            }

            if (errors.filter(e => e.row === rowNum).length === 0) {
                validRows.push(rowData);
            }
        }

        // Если есть ошибки - возвращаем их
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                errors,
                message: `Найдены ошибки в ${errors.length} ячейках`,
            });
        }

        if (validRows.length === 0) {
            return errorSend(res, { message: "Нет данных для импорта" });
        }

        // Создаём участников
        const [created, err] = await wrap(participantDAL.createBatch(projectId, validRows));
        if (err || !created) {
            return dbError(res, "#IMPORTEXCEL1");
        }

        // Записываем логи
        for (const participant of created) {
            await participantLogsDAL.create({
                projectId,
                participantId: participant.id,
                action: "CREATE",
                actor: "USER",
                userId,
                currentData: participant.data,
            });
        }

        res.json({
            success: true,
            imported: created.length,
            message: `Импортировано ${created.length} участников`,
        });
    }

    /**
     * GET /projects/:projectId/participants/export
     * Экспорт участников в Excel
     */
    async exportToExcel(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        // Получаем схему проекта
        const [fields] = await wrap(fieldDAL.getByProjectId(projectId));
        if (!fields) {
            return dbError(res, "#EXPORTEXCEL1");
        }

        // Получаем всех участников (с фильтрами и поиском)
        const [participants] = await wrap(participantDAL.getAllByProjectId(projectId, req.query as any));
        if (!participants) {
            return dbError(res, "#EXPORTEXCEL2");
        }

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet("Участники");

        // Заголовки = labels полей + служебные поля
        const columns = [
            { header: "ID", key: "_id", width: 10 },
            ...fields.map(field => ({
                header: field.label,
                key: field.key,
                width: 20,
            })),
            { header: "Дата создания", key: "_created_at", width: 20 },
        ];
        worksheet.columns = columns;

        // Добавляем строки
        for (const p of participants) {
            const row: Record<string, any> = {
                _id: p.id,
                _created_at: p.created_at,
            };
            
            for (const field of fields) {
                let value = p.data[field.key];
                
                // Преобразование массивов в строку
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                
                row[field.key] = value;
            }
            
            worksheet.addRow(row);
        }

        // Стилизация заголовков
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' },
        };

        // Отправляем файл
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=participants_project_${projectId}_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * DELETE /projects/:projectId/participants
     * Очистка всех участников и логов проекта
     */
    async clearAll(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        // Удаляем сначала логи
        const [logsDeleted, logsErr] = await wrap(participantLogsDAL.deleteAllByProject(projectId));
        if (logsErr) {
            return dbError(res, "#CLEARALL1");
        }

        // Удаляем участников
        const [participantsDeleted, participantsErr] = await wrap(participantDAL.deleteAllByProject(projectId));
        if (participantsErr) {
            return dbError(res, "#CLEARALL2");
        }

        res.json({
            success: true,
            deleted: {
                participants: participantsDeleted,
                logs: logsDeleted,
            },
            message: `Удалено ${participantsDeleted} участников и ${logsDeleted} записей лога`,
        });
    }
}

// ===== Вспомогательные функции =====

/**
 * Получить подсказку по типу поля
 */
function getFieldTypeHint(config: ProjectFieldConfig): string {
    switch (config.type) {
        case 'text':
            return config.maxLength ? `текст, макс ${config.maxLength} симв.` : 'текст';
        case 'bool':
            return 'true/false';
        case 'list':
            if (config.listSettings) {
                const values = config.listSettings.items.map(i => i.value).join(', ');
                const multiple = config.listSettings.multiple ? ', множ. выбор' : '';
                return `список: ${values}${multiple}`;
            }
            return 'список';
        case 'img':
            return 'URL изображения';
        case 'code':
            return 'код';
        default:
            return 'текст';
    }
}

/**
 * Валидация данных строки
 */
function validateRowData(
    data: Record<string, any>,
    fieldMap: Map<string, { key: string; label: string; config: ProjectFieldConfig }>,
    rowNum: number
): { row: number; field: string; message: string }[] {
    const errors: { row: number; field: string; message: string }[] = [];

    for (const [key, value] of Object.entries(data)) {
        const field = fieldMap.get(key);
        if (!field) continue; // Игнорируем неизвестные поля

        const { config, label } = field;

        switch (config.type) {
            case 'text':
                if (typeof value !== 'string' && typeof value !== 'number') {
                    errors.push({ row: rowNum, field: key, message: `${label}: ожидается текст` });
                } else if (config.maxLength && String(value).length > config.maxLength) {
                    errors.push({ row: rowNum, field: key, message: `${label}: макс ${config.maxLength} символов` });
                }
                break;

            case 'bool':
                const boolValue = String(value).toLowerCase();
                if (!['true', 'false', '1', '0', 'да', 'нет'].includes(boolValue)) {
                    errors.push({ row: rowNum, field: key, message: `${label}: ожидается true/false` });
                }
                // Преобразуем в boolean
                data[key] = ['true', '1', 'да'].includes(boolValue);
                break;

            case 'list':
                if (config.listSettings) {
                    const allowedValues = config.listSettings.items.map(i => i.value);
                    
                    if (config.listSettings.multiple) {
                        // Для множественного выбора - разбиваем строку по запятой
                        const values = String(value).split(',').map(v => v.trim()).filter(Boolean);
                        const invalid = values.filter(v => !allowedValues.includes(v));
                        if (invalid.length > 0) {
                            errors.push({ row: rowNum, field: key, message: `${label}: недопустимые значения: ${invalid.join(', ')}` });
                        } else {
                            data[key] = values;
                        }
                    } else {
                        if (!allowedValues.includes(String(value))) {
                            errors.push({ row: rowNum, field: key, message: `${label}: допустимо: ${allowedValues.join(', ')}` });
                        }
                    }
                }
                break;

            case 'img':
            case 'code':
                // Просто преобразуем в строку
                data[key] = String(value);
                break;
        }
    }

    return errors;
}
