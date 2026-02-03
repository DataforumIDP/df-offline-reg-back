import { Request, Response, NextFunction } from "express";
import { participantLogsDAL, LogsQuery } from "../dal/participantLogsDAL";
import { ParticipantLogHelper } from "../models/participantLogs";
import { wrap } from "../utils/wrap";
import { dbError } from "../utils/errors";

class ParticipantLogService {
    /**
     * GET /projects/:projectId/participants/log/stats
     * Получить статистику по действиям
     */
    async getStats(req: Request, res: Response) {
        const projectId = req.appValues?.project?.id;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        const [stats, err] = await wrap(participantLogsDAL.getStats(projectId));

        if (err || !stats) {
            return dbError(res, "#GETSTATS1");
        }

        res.json(stats);
    }

    /**
     * GET /projects/:projectId/participants/log
     * Получить все логи проекта
     */
    async getAll(req: Request, res: Response) {
        const projectId = req.appValues?.project?.id;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required" });
        }

        const query: LogsQuery = {
            search: req.query.search as string,
            action: req.query.action as any,
            actor: req.query.actor as any,
            participantId: req.query.participantId as string,
            userId: req.query.userId as string,
            dateStart: req.query.dateStart as string,
            dateEnd: req.query.dateEnd as string,
        };

        const [logs, err] = await wrap(participantLogsDAL.getAllByProjectId(projectId, query));

        if (err || !logs) {
            return dbError(res, "#GETLOGS1");
        }

        res.json({
            records: logs.map(ParticipantLogHelper.toJSON),
        });
    }

    /**
     * GET /projects/:projectId/participants/:participantId/log
     * Получить логи конкретного участника
     */
    async getByParticipant(req: Request, res: Response) {
        const participantId = parseInt(req.params.participantId, 10);

        if (isNaN(participantId)) {
            return res.status(400).json({ error: "Invalid participant ID" });
        }

        const [logs, err] = await wrap(participantLogsDAL.getByParticipantId(participantId));

        if (err || !logs) {
            return dbError(res, "#GETPARTICIPANTLOGS1");
        }

        res.json({
            logs: logs.map(ParticipantLogHelper.toJSON),
        });
    }
}

export const participantLogService = new ParticipantLogService();
