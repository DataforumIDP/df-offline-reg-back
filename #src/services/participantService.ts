import { Request, Response } from "express";
import { ParticipantsDAL } from "../dal/participantsDAL";
import { participantLogsDAL } from "../dal/participantLogsDAL";
import { ParticipantHelper } from "../models/participants";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { response201, response204 } from "../utils/responses";
import { paginationResponse } from "../utils/paginationUtils";

const participantDAL = new ParticipantsDAL();

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
}
