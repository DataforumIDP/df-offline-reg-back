import { Request, Response, NextFunction } from "express";
import { participantLogsDAL, LogsQuery } from "../dal/participantLogsDAL";
import { ParticipantLogHelper } from "../models/participantLogs";
import { paginationResponse } from "../utils/paginationUtils";

class ParticipantLogService {
    /**
     * GET /projects/:projectId/participants/log/stats
     * Получить статистику по действиям
     */
    async getStats(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = req.appValues?.project?.id;

            if (!projectId) {
                return res.status(400).json({ error: "Project ID is required" });
            }

            const stats = await participantLogsDAL.getStats(projectId);

            res.json(stats);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /projects/:projectId/participants/log
     * Получить логи с пагинацией и фильтрами
     */
    async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const projectId = req.appValues?.project?.id;

            if (!projectId) {
                return res.status(400).json({ error: "Project ID is required" });
            }

            const query: LogsQuery = {
                page: req.query.page as string,
                limit: req.query.limit as string,
                search: req.query.search as string,
                action: req.query.action as any,
                actor: req.query.actor as any,
                participantId: req.query.participantId as string,
                userId: req.query.userId as string,
                dateStart: req.query.dateStart as string,
                dateEnd: req.query.dateEnd as string,
            };

            const [logs, { total }] = await participantLogsDAL.getByProjectId(projectId, query);

            const page = Math.max(1, parseInt(query.page || "1", 10));
            const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));

            res.json(
                paginationResponse({
                    list: logs.map(ParticipantLogHelper.toJSON),
                    all: total,
                    limit: query.limit || "20",
                    page: query.page || "1",
                })
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /projects/:projectId/participants/:participantId/log
     * Получить логи конкретного участника
     */
    async getByParticipant(req: Request, res: Response, next: NextFunction) {
        try {
            const participantId = parseInt(req.params.participantId, 10);

            if (isNaN(participantId)) {
                return res.status(400).json({ error: "Invalid participant ID" });
            }

            const logs = await participantLogsDAL.getByParticipantId(participantId);

            res.json({
                logs: logs.map(ParticipantLogHelper.toJSON),
            });
        } catch (error) {
            next(error);
        }
    }
}

export const participantLogService = new ParticipantLogService();
