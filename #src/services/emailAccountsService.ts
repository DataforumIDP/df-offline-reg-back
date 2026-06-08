import { Request, Response, NextFunction } from "express";
import { emailAccountsDAL } from "../dal/emailAccountsDAL";
import { EmailAccountHelper } from "../models/emailAccounts";
import { wrap } from "../utils/wrap";
import { dbError, error404, errorSend } from "../utils/errors";
import { response201, response204 } from "../utils/responses";

const SLUG_RE = /^[a-z0-9_-]{1,100}$/;

class EmailAccountsService {
    /**
     * GET /email-accounts
     */
    async getAll(_req: Request, res: Response, next: NextFunction) {
        try {
            const accounts = await emailAccountsDAL.getAll();
            res.json({ accounts: accounts.map(EmailAccountHelper.toJSON) });
        } catch (err) {
            next(err);
        }
    }

    /**
     * POST /email-accounts
     * Body: { slug, host, port, secure, login, password, fromName? }
     */
    async create(req: Request, res: Response, next: NextFunction) {
        try {
            const { slug, host, port, secure, login, password, alias, fromName } = req.body;

            const errors: Record<string, string> = {};
            if (!slug || !SLUG_RE.test(slug)) errors.slug = "slug: только a-z, 0-9, _ и - (до 100 символов)";
            if (!host?.trim()) errors.host = "Хост обязателен";
            if (port === undefined || port === null || !Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)
                errors.port = "Порт должен быть числом от 1 до 65535";
            if (!login?.trim()) errors.login = "Логин обязателен";
            if (!password?.trim()) errors.password = "Пароль обязателен";
            if (Object.keys(errors).length) return errorSend(res, errors);

            const taken = await emailAccountsDAL.isSlugTaken(slug);
            if (taken) return errorSend(res, { slug: "Такой slug уже занят" });

            const [account, err] = await wrap(
                emailAccountsDAL.create({
                    slug,
                    host: host.trim(),
                    port: Number(port),
                    secure: secure !== false && secure !== "false",
                    login: login.trim(),
                    password: password.trim(),
                    alias: alias?.trim() || null,
                    from_name: fromName?.trim() || null,
                })
            );
            if (err || !account) return dbError(res, "#CREATEEMAILACCOUNT1");

            response201(res, EmailAccountHelper.toJSON(account));
        } catch (err) {
            next(err);
        }
    }

    /**
     * PUT /email-accounts/:id
     */
    async update(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const existing = await emailAccountsDAL.getById(id);
            if (!existing) return error404(res, "Email-аккаунт не найден");

            const { slug, host, port, secure, login, password, alias, fromName } = req.body;

            const errors: Record<string, string> = {};
            if (slug !== undefined && !SLUG_RE.test(slug)) errors.slug = "slug: только a-z, 0-9, _ и - (до 100 символов)";
            if (port !== undefined && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535))
                errors.port = "Порт должен быть числом от 1 до 65535";
            if (Object.keys(errors).length) return errorSend(res, errors);

            if (slug && slug !== existing.slug) {
                const taken = await emailAccountsDAL.isSlugTaken(slug, id);
                if (taken) return errorSend(res, { slug: "Такой slug уже занят" });
            }

            const updateData: Record<string, any> = {};
            if (slug !== undefined) updateData.slug = slug;
            if (host !== undefined) updateData.host = host.trim();
            if (port !== undefined) updateData.port = Number(port);
            if (secure !== undefined) updateData.secure = secure !== false && secure !== "false";
            if (login !== undefined) updateData.login = login.trim();
            if (password !== undefined && password.trim()) updateData.password = password.trim();
            if (alias !== undefined) updateData.alias = alias?.trim() || null;
            if (fromName !== undefined) updateData.from_name = fromName?.trim() || null;

            const [updated, err] = await wrap(emailAccountsDAL.update(id, updateData));
            if (err || !updated) return dbError(res, "#UPDATEEMAILACCOUNT1");

            res.json(EmailAccountHelper.toJSON(updated));
        } catch (err) {
            next(err);
        }
    }

    /**
     * DELETE /email-accounts/:id
     */
    async delete(req: Request, res: Response, next: NextFunction) {
        try {
            const id = parseInt(req.params.id, 10);
            const account = await emailAccountsDAL.getById(id);
            if (!account) return error404(res, "Email-аккаунт не найден");

            await emailAccountsDAL.softDelete(id);
            response204(res);
        } catch (err) {
            next(err);
        }
    }
}

export const emailAccountsService = new EmailAccountsService();
