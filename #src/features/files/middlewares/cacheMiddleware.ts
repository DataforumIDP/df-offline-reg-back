import { Request, Response, NextFunction } from 'express'

// Простая заглушка для кеша
const cache = new Map();

export const cacheMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Кешируем только GET-запросы без Range header (для обычных файлов, не для стриминга)
    if (req.method !== 'GET' || req.headers.range) {
        return next()
    }

    const cacheKey = req.originalUrl || req.url
    const cachedResponse = cache.get(cacheKey)

    if (cachedResponse) {
        // Возвращаем кешированный ответ
        const { body, headers } = cachedResponse as {
            body: Buffer
            headers: any
        }

        // Устанавливаем заголовки из кеша
        Object.keys(headers).forEach((header) => {
            res.setHeader(header, headers[header])
        })

        // Отправляем кешированный контент
        return res.send(body)
    }

    // Сохраняем оригинальный метод end
    const originalEnd = res.end
    const chunks: Buffer[] = []

    // Переопределяем метод write для сбора данных
    res.write = function (chunk: Buffer) {
        chunks.push(Buffer.from(chunk))
        return true
    }

    // Переопределяем метод end для кеширования ответа
    res.end = function (chunk?: any) {
        if (chunk) {
            chunks.push(Buffer.from(chunk))
        }

        // Получаем полный ответ
        const body = Buffer.concat(chunks)

        // Кешируем только успешные ответы
        if (res.statusCode >= 200 && res.statusCode < 300) {
            const headers = {}
            const headerKeys = res.getHeaderNames()

            headerKeys.forEach((key) => {
                headers[key] = res.getHeader(key)
            })

            // Сохраняем в кеш
            cache.set(cacheKey, { body, headers })
        }

        // Вызываем оригинальный метод end
        return originalEnd.apply(res, [body, 'utf8'])
    }

    next()
}
