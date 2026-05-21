import { Request, Response, NextFunction } from "express";
import { ProjectsDAL } from "../../dal/projectsDAL";
import { ParticipantsDAL } from "../../dal/participantsDAL";
import { wrap } from "../../utils/wrap";
import { error404 } from "../../utils/errors";

const projectDAL = new ProjectsDAL();
const participantDAL = new ParticipantsDAL();

export const loadProject = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number(req.params.projectId);
    const [project] = await wrap(projectDAL.findByPk(projectId));
    if (!project) return error404(res, "Проект не найден");
    req.project = project;
    req.appValues = { ...req.appValues, project };
    next();
};

export const loadParticipant = async (req: Request, res: Response, next: NextFunction) => {
    const projectId = Number(req.params.projectId);
    const participantId = Number(req.params.participantId);
    const [participant] = await wrap(participantDAL.getByIdAndProject(participantId, projectId));
    if (!participant) return error404(res, "Участник не найден");
    req.participant = participant;
    next();
};
