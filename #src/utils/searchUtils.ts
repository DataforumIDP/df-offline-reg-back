/**
 * Утилита для продвинутого поиска участников
 * 
 * Поддерживает:
 * - Регистронезависимый поиск
 * - Поиск по триграммам (нечёткий поиск с опечатками)
 * - Нормализация телефонов (поиск только по цифрам)
 * - Автоматическая конвертация раскладки RU<->EN
 * - Комбинированный поиск: пробел = AND, || = OR
 * - Поиск по конкретному ключу: {{key: value}}
 */

// Карта раскладок RU -> EN
const ruToEn: Record<string, string> = {
    'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p',
    'х': '[', 'ъ': ']', 'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k',
    'д': 'l', 'ж': ';', 'э': "'", 'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm',
    'б': ',', 'ю': '.', 'ё': '`',
    'Й': 'Q', 'Ц': 'W', 'У': 'E', 'К': 'R', 'Е': 'T', 'Н': 'Y', 'Г': 'U', 'Ш': 'I', 'Щ': 'O', 'З': 'P',
    'Х': '{', 'Ъ': '}', 'Ф': 'A', 'Ы': 'S', 'В': 'D', 'А': 'F', 'П': 'G', 'Р': 'H', 'О': 'J', 'Л': 'K',
    'Д': 'L', 'Ж': ':', 'Э': '"', 'Я': 'Z', 'Ч': 'X', 'С': 'C', 'М': 'V', 'И': 'B', 'Т': 'N', 'Ь': 'M',
    'Б': '<', 'Ю': '>', 'Ё': '~',
};

// Карта раскладок EN -> RU
const enToRu: Record<string, string> = Object.fromEntries(
    Object.entries(ruToEn).map(([ru, en]) => [en, ru])
);

/**
 * Конвертировать строку из одной раскладки в другую
 */
export function convertLayout(text: string): string {
    // Определяем направление по первой букве
    const firstLetter = text.match(/[a-zA-Zа-яА-ЯёЁ]/)?.[0];
    if (!firstLetter) return text;

    const isRussian = /[а-яА-ЯёЁ]/.test(firstLetter);
    const map = isRussian ? ruToEn : enToRu;

    return text.split('').map(char => map[char] || char).join('');
}

/**
 * Извлечь только цифры из строки
 */
export function extractDigits(text: string): string {
    return text.replace(/[^0-9]/g, '');
}

/**
 * Проверить, является ли строка телефоноподобной (содержит в основном цифры)
 */
export function isPhoneLike(text: string): boolean {
    const digits = extractDigits(text);
    // Если больше половины символов - цифры, считаем телефоном
    return digits.length >= 7 && digits.length / text.replace(/\s/g, '').length > 0.5;
}

/**
 * Условие поиска
 */
export interface SearchCondition {
    key?: string;           // Конкретный ключ для поиска (из {{key: value}})
    value: string;          // Значение для поиска
    convertedValue: string; // Значение с конвертированной раскладкой
    digitsOnly?: string;    // Только цифры (для телефонов)
}

/**
 * Группа условий (AND)
 */
export interface SearchGroup {
    conditions: SearchCondition[];
}

/**
 * Результат парсинга поискового запроса
 */
export interface ParsedSearch {
    orGroups: SearchGroup[]; // Группы, объединённые через OR (++)
}

/**
 * Распарсить поисковую строку
 * 
 * Примеры:
 * - "Иванов Иван" -> AND: [Иванов, Иван]
 * - "Иванов || VIP" -> OR: [Иванов], [VIP]
 * - "{{work: НИИ}}" -> поиск по ключу work
 * - "bdfyjd Bdfy {{work: DATAFORUM}} || 89524848041" -> сложный запрос
 */
export function parseSearchQuery(search: string): ParsedSearch {
    if (!search || !search.trim()) {
        return { orGroups: [] };
    }

    // Разбиваем по || (OR)
    const orParts = search.split('||').map(s => s.trim()).filter(Boolean);

    const orGroups: SearchGroup[] = orParts.map(orPart => {
        const conditions: SearchCondition[] = [];

        // Извлекаем условия с ключами {{key: value}}
        const keyValueRegex = /\{\{(\w+):\s*([^}]+)\}\}/g;
        let match;
        let remainingPart = orPart;

        while ((match = keyValueRegex.exec(orPart)) !== null) {
            const [fullMatch, key, value] = match;
            const trimmedValue = value.trim();
            
            conditions.push({
                key: key.trim(),
                value: trimmedValue,
                convertedValue: convertLayout(trimmedValue),
                digitsOnly: isPhoneLike(trimmedValue) ? extractDigits(trimmedValue) : undefined,
            });

            remainingPart = remainingPart.replace(fullMatch, ' ');
        }

        // Остальные слова - обычные условия (AND)
        const words = remainingPart.split(/\s+/).filter(Boolean);
        
        for (const word of words) {
            conditions.push({
                value: word,
                convertedValue: convertLayout(word),
                digitsOnly: isPhoneLike(word) ? extractDigits(word) : undefined,
            });
        }

        return { conditions };
    });

    return { orGroups: orGroups.filter(g => g.conditions.length > 0) };
}

/**
 * Построить SQL условие для одного условия поиска
 * Использует ? плейсхолдеры для Knex whereRaw
 * Ключ тоже передаётся как параметр для безопасности
 * 
 * Для триграмм используем EXISTS с проверкой каждого значения JSONB отдельно
 */
export function buildConditionSQL(condition: SearchCondition): { sql: string; params: (string | number)[] } {
    const params: (string | number)[] = [];
    const sqlParts: string[] = [];

    // Для триграммного поиска: проверяем каждое значение в JSONB отдельно
    // EXISTS (SELECT 1 FROM jsonb_each_text(data) WHERE value % 'поиск')
    const trigramExistsExpr = `EXISTS (SELECT 1 FROM jsonb_each_text(data) jt WHERE jt.value % ?)`;

    if (condition.key) {
        // Поиск по конкретному ключу
        sqlParts.push(`(data->>?::text ILIKE ?)`);
        params.push(condition.key, `%${condition.value}%`);

        // Добавляем поиск с конвертированной раскладкой
        if (condition.convertedValue !== condition.value) {
            sqlParts.push(`(data->>?::text ILIKE ?)`);
            params.push(condition.key, `%${condition.convertedValue}%`);
        }

        // Триграммный поиск по конкретному ключу
        sqlParts.push(`(data->>?::text % ?)`);
        params.push(condition.key, condition.value);
    } else {
        // Поиск по всем полям
        // ILIKE по сырому JSON
        sqlParts.push(`(data::text ILIKE ?)`);
        params.push(`%${condition.value}%`);

        // Добавляем поиск с конвертированной раскладкой
        if (condition.convertedValue !== condition.value) {
            sqlParts.push(`(data::text ILIKE ?)`);
            params.push(`%${condition.convertedValue}%`);
        }

        // Триграммный поиск - проверяем каждое значение JSONB отдельно
        // Это позволяет найти "Иваноф" когда в базе "Иванов"
        sqlParts.push(`(${trigramExistsExpr})`);
        params.push(condition.value);
    }

    // Поиск по цифрам (для телефонов)
    if (condition.digitsOnly && condition.digitsOnly.length >= 4) {
        sqlParts.push(`(extract_digits(data::text) LIKE ?)`);
        params.push(`%${condition.digitsOnly}%`);
    }

    return {
        sql: `(${sqlParts.join(' OR ')})`,
        params,
    };
}

/**
 * Построить полное SQL условие для поискового запроса
 * Использует ? плейсхолдеры для Knex whereRaw
 */
export function buildSearchSQL(parsed: ParsedSearch): { sql: string; params: (string | number)[] } {
    if (parsed.orGroups.length === 0) {
        return { sql: '', params: [] };
    }

    const allParams: (string | number)[] = [];

    const orGroupsSql = parsed.orGroups.map(group => {
        const andConditionsSql = group.conditions.map(condition => {
            const { sql, params } = buildConditionSQL(condition);
            allParams.push(...params);
            return sql;
        });

        // Объединяем условия внутри группы через AND
        return `(${andConditionsSql.join(' AND ')})`;
    });

    // Объединяем группы через OR
    return {
        sql: `(${orGroupsSql.join(' OR ')})`,
        params: allParams,
    };
}
