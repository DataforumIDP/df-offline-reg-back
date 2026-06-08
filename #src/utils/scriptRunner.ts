import ivm from "isolated-vm";
import axiosLib from "axios";
import nodemailer from "nodemailer";
import ts from "typescript";
import { emailAccountsDAL } from "../dal/emailAccountsDAL";

const SCRIPT_TIMEOUT_MS = 2000;
const MEMORY_LIMIT_MB = 8;
const HTTP_TIMEOUT_MS = 8000;

// Функция транслитерации — передаётся как исходный код внутрь изолята
const TRANSLIT_FN_SRC = `
function translitRuToEn(str) {
    var map = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
        'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
        'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
        'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu',
        'я':'ya'
    };
    return String(str).split('').map(function(c) {
        var lower = c.toLowerCase();
        if (map[lower] !== undefined) {
            var t = map[lower];
            return c !== lower ? t.charAt(0).toUpperCase() + t.slice(1) : t;
        }
        return c;
    }).join('');
}
`;

export type ScriptOrigin = 'webhook' | 'excel' | 'form';

/**
 * Выполняет произвольный JS/TS-скрипт в изолированном V8 isolate.
 *
 * Скрипт должен быть стрелочной функцией вида: (data: RequestData) => { ... return ... }
 *
 * Внутри скрипта доступны:
 *   data.user        — пользовательские данные
 *   data.utils.axios — HTTP-клиент (get/post/put/delete)
 *   data.utils.translitRuToEn(str) — транслитерация рус→лат
 *   data.utils.mail(opts) — отправка письма через сохранённый email-аккаунт
 *   data.utils.origin — источник: 'webhook' | 'excel' | 'form'
 *
 * - Нет доступа к require, process, fs, глобальным объектам Node.
 * - Таймаут CPU: 2 секунды.
 * - Лимит памяти: 8 МБ.
 * - Таймаут HTTP-запросов: 8 секунд.
 *
 * @throws Error с человекочитаемым сообщением при ошибке в скрипте
 */
export async function runScript(
    scriptCode: string,
    data: { user: Record<string, any> },
    origin: ScriptOrigin = 'form'
): Promise<Record<string, any>> {
    // Транспилируем TypeScript → JavaScript (убирает аннотации типов)
    const jsCode = ts.transpileModule(scriptCode, {
        compilerOptions: { target: ts.ScriptTarget.ES2020 },
    }).outputText.trim();

    const isolate = new ivm.Isolate({ memoryLimit: MEMORY_LIMIT_MB });

    try {
        const context = await isolate.createContext();
        const jail = context.global;

        // Передаём пользовательские данные в изолят
        await jail.set(
            "__userData__",
            new ivm.ExternalCopy(data.user).copyInto()
        );
        await jail.set("__origin__", new ivm.ExternalCopy(origin).copyInto());

        // Axios-прокси: вызывается из изолята, исполняется в хосте
        const axiosFn = new ivm.Reference(async (
            method: string,
            url: string,
            bodyStr: string | null,
            configStr: string | null
        ): Promise<string> => {
            const body = bodyStr ? JSON.parse(bodyStr) : undefined;
            const config = configStr ? JSON.parse(configStr) : {};
            const res = await axiosLib({
                method,
                url,
                data: body,
                timeout: HTTP_TIMEOUT_MS,
                ...config,
            });
            return JSON.stringify({
                data: res.data,
                status: res.status,
                headers: res.headers,
            });
        });
        await jail.set("__axiosFn__", axiosFn);

        // mail()-прокси: вызывается из изолята, исполняется в хосте
        const mailFn = new ivm.Reference(async (optsStr: string): Promise<string> => {
            const opts: {
                slug: string;
                mail: string | string[];
                html: string;
                theme: string;
                params?: Record<string, string>;
            } = JSON.parse(optsStr);

            const account = await emailAccountsDAL.getBySlug(opts.slug);
            if (!account) throw new Error(`mail(): email-аккаунт '${opts.slug}' не найден`);

            // Получаем HTML — либо скачиваем по URL, либо используем как есть
            let html = opts.html;
            if (/^https?:\/\//i.test(html)) {
                const resp = await axiosLib.get<string>(html, {
                    timeout: HTTP_TIMEOUT_MS,
                    responseType: "text",
                });
                html = resp.data;
            }

            // Подставляем параметры
            if (opts.params && typeof opts.params === "object") {
                for (const [key, value] of Object.entries(opts.params)) {
                    html = html.split(key).join(String(value));
                }
            }

            const recipients = Array.isArray(opts.mail) ? opts.mail : [opts.mail];
            const senderEmail = account.alias?.trim() || account.login;
            const fromAddress = account.from_name
                ? `"${account.from_name}" <${senderEmail}>`
                : senderEmail;

            if ((account.provider ?? 'smtp') === 'rusender') {
                // ── RuSender API ───────────────────────────────────────────
                if (!account.api_key) throw new Error(`mail(): api_key не задан для аккаунта '${opts.slug}'`);
                for (const recipient of recipients) {
                    await axiosLib.post(
                        'https://api.rusender.ru/api/v1/external-mails/send',
                        {
                            mail: {
                                to: { email: recipient },
                                from: {
                                    email: senderEmail,
                                    ...(account.from_name ? { name: account.from_name } : {}),
                                },
                                subject: opts.theme,
                                html,
                            },
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Api-Key': account.api_key,
                            },
                            timeout: HTTP_TIMEOUT_MS,
                        }
                    );
                }
            } else {
                // ── SMTP via nodemailer ────────────────────────────────────
                const transporter = nodemailer.createTransport({
                    host: account.host!,
                    port: account.port!,
                    secure: account.secure!,
                    auth: { user: account.login!, pass: account.password! },
                });

                await transporter.sendMail({
                    from: fromAddress ?? account.login ?? undefined,
                    to: recipients.join(", "),
                    subject: opts.theme,
                    html,
                });
            }

            return JSON.stringify({ ok: true, recipients: recipients.length });
        });
        await jail.set("__mailFn__", mailFn);

        const wrappedCode = `
(async function() {
    ${TRANSLIT_FN_SRC}

    var data = {
        user: __userData__,
        utils: {
            translitRuToEn: translitRuToEn,
            axios: {
                get: async function(url, cfg) {
                    var r = await __axiosFn__.apply(null, ['get', url, null, cfg ? JSON.stringify(cfg) : null], { arguments: { copy: true }, result: { promise: true, copy: true } });
                    return JSON.parse(r);
                },
                post: async function(url, body, cfg) {
                    var r = await __axiosFn__.apply(null, ['post', url, JSON.stringify(body != null ? body : {}), cfg ? JSON.stringify(cfg) : null], { arguments: { copy: true }, result: { promise: true, copy: true } });
                    return JSON.parse(r);
                },
                put: async function(url, body, cfg) {
                    var r = await __axiosFn__.apply(null, ['put', url, JSON.stringify(body != null ? body : {}), cfg ? JSON.stringify(cfg) : null], { arguments: { copy: true }, result: { promise: true, copy: true } });
                    return JSON.parse(r);
                },
                delete: async function(url, cfg) {
                    var r = await __axiosFn__.apply(null, ['delete', url, null, cfg ? JSON.stringify(cfg) : null], { arguments: { copy: true }, result: { promise: true, copy: true } });
                    return JSON.parse(r);
                },
            },
            mail: async function(opts) {
                var r = await __mailFn__.apply(null, [JSON.stringify(opts)], { arguments: { copy: true }, result: { promise: true, copy: true } });
                return JSON.parse(r);
            },
            /** Источник регистрации: 'webhook' | 'excel' | 'form' */
            origin: __origin__,
        }
    };

    var __fn__ = ${jsCode};
    var __result__ = await __fn__(data);
    return JSON.stringify(__result__ !== undefined ? __result__ : __userData__);
})();
`;

        const script = await isolate.compileScript(wrappedCode);

        const resultRef = await script.run(context, {
            timeout: SCRIPT_TIMEOUT_MS,
            promise: true,
        }) as ivm.Reference<string>;

        const resultStr = resultRef instanceof ivm.Reference
            ? await resultRef.copy()
            : resultRef;

        const parsed = JSON.parse(resultStr as string);

        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Скрипт должен возвращать объект");
        }

        return parsed;
    } catch (err: any) {
        throw new Error(err?.message ?? String(err));
    } finally {
        isolate.dispose();
    }
}
