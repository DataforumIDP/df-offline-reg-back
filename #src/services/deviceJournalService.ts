import { Request, Response } from "express";
import { deviceJournalDAL, JournalQuery } from "../dal/deviceJournalDAL";
import { DeviceJournalHelper } from "../models/deviceJournal";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response200, response201 } from "../utils/responses";

/**
 * Сервис журнала устройств (админ-панель)
 */
export class DeviceJournalService {
    /**
     * GET /projects/:projectId/journal
     * Получить записи журнала с пагинацией и фильтрами
     */
    async getAll(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);
        const query: JournalQuery = {
            page: req.query.page as string,
            limit: req.query.limit as string,
            search: req.query.search as string,
            isReturned: req.query.isReturned as string,
            zoneId: req.query.zoneId as string,
            dateStart: req.query.dateStart as string,
            dateEnd: req.query.dateEnd as string,
        };

        const [result, err] = await wrap(deviceJournalDAL.getAll(projectId, query));

        if (err || !result) {
            return dbError(res, "#JOURNAL_GET1");
        }

        response200(res, {
            records: result.records.map(DeviceJournalHelper.toJSON),
            totalRecords: result.totalRecords,
            totalPages: result.totalPages,
            page: result.page,
            recordsPerPage: result.limit,
        });
    }

    /**
     * GET /projects/:projectId/journal/stats
     * Получить статистику журнала
     */
    async getStats(req: Request, res: Response) {
        const projectId = Number(req.params.projectId);

        const [stats, err] = await wrap(deviceJournalDAL.getStats(projectId));

        if (err || !stats) {
            return dbError(res, "#JOURNAL_STATS1");
        }

        response200(res, stats);
    }

    /**
     * POST /projects/:projectId/journal/:recordId/return
     * Ручной возврат устройства через админку
     */
    async manualReturn(req: Request, res: Response) {
        const recordId = Number(req.params.recordId);

        const [record, err] = await wrap(deviceJournalDAL.checkinById(recordId, true));

        if (err) {
            return dbError(res, "#JOURNAL_RETURN1");
        }

        if (!record) {
            return res.status(404).json({
                error: "Запись не найдена или уже возвращена",
                code: "NOT_FOUND",
            });
        }

        response200(res, {
            message: "Устройство отмечено как сданное",
            record: DeviceJournalHelper.toJSON(record),
        });
    }
}

export const deviceJournalService = new DeviceJournalService();
