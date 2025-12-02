import { Router } from "express";
import { ProjectService } from "../services/projectService";
import { createMiddlewares } from "../middlewares/projects/createMiddlewares";
import { updateMiddlewares } from "../middlewares/projects/updateMiddlewares";
import { deleteMiddlewares } from "../middlewares/projects/deleteMiddlewares";
import { getMiddlewares } from "../middlewares/projects/getMiddlewares";
import { getOneMiddlewares } from "../middlewares/projects/getOneMiddlewares";

export const projectsRouter = Router();

const project = new ProjectService();

projectsRouter.post("/", createMiddlewares, project.create);
projectsRouter.patch("/:id", updateMiddlewares, project.update);
projectsRouter.get("/", getMiddlewares, project.get);
projectsRouter.get("/:id/users", getMiddlewares, project.getUsers);
projectsRouter.get("/:slugOrId", getOneMiddlewares, project.getOne);
projectsRouter.delete("/:id", deleteMiddlewares, project.delete);
