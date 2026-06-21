import { Response } from "express";
import { db } from "../config/db";
import { dbError } from "../utils/errors";
import { wrap } from "../utils/wrap";
import { ReqWithBody, ReqWithParams } from "../baseTypes";

export class ProjectScriptsService {
    async get(req: ReqWithParams<{ projectId: string }>, res: Response) {
        const projectId = Number(req.params.projectId);

        const [row, err] = await wrap(
            db("projects").where({ id: projectId }).first("pre_script", "post_script")
        );

        if (err) return dbError(res, "#SCRIPTS_GET1");

        res.json({ preScript: row?.pre_script ?? null, postScript: row?.post_script ?? null });
    }

    async update(
        req: ReqWithParams<{ projectId: string }> & ReqWithBody<{ preScript?: string | null; postScript?: string | null }>,
        res: Response
    ) {
        const projectId = Number(req.params.projectId);
        const { preScript, postScript } = req.body;

        if (preScript !== undefined && preScript !== null && typeof preScript !== "string") {
            return res.status(400).json({ errors: { preScript: "preScript должен быть строкой или null" } });
        }
        if (postScript !== undefined && postScript !== null && typeof postScript !== "string") {
            return res.status(400).json({ errors: { postScript: "postScript должен быть строкой или null" } });
        }

        const [, updateErr] = await wrap(
            db("projects").where({ id: projectId }).update({
                pre_script: preScript ?? null,
                post_script: postScript ?? null,
                updated_at: db.fn.now(),
            })
        );

        if (updateErr) return dbError(res, "#SCRIPTS_UPD1");

        const [row, err] = await wrap(
            db("projects").where({ id: projectId }).first("pre_script", "post_script")
        );

        if (err) return dbError(res, "#SCRIPTS_UPD2");

        res.json({ preScript: row?.pre_script ?? null, postScript: row?.post_script ?? null });
    }
}

export const projectScriptsService = new ProjectScriptsService();
