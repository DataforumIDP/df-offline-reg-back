import { parsePhoneNumber, isValidPhoneNumber, CountryCode, formatIncompletePhoneNumber } from 'libphonenumber-js';

/**
 * Нормализация телефонного номера для хранения в базе.
 * Оставляет только цифры, заменяет 8 в начале на 7 (для российских номеров).
 * 
 * @param phone - исходный номер телефона
 * @returns нормализованный номер (только цифры)
 */
export function normalizePhone(phone: string | number | null | undefined): string {
    if (phone === null || phone === undefined) {
        return '';
    }
    
    // Преобразуем в строку
    let phoneStr = String(phone);
    
    // Оставляем только цифры
    let digits = phoneStr.replace(/\D/g, '');
    
    // Заменяем 8 в начале на 7 (для российских номеров)
    if (digits.length === 11 && digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }
    
    return digits;
}

/**
 * Форматирование телефонного номера для отображения.
 * Приводит к международному формату страны (например, +7 (952) 484-80-41).
 * Если форматирование не удалось — возвращает исходную строку.
 * 
 * @param phone - номер телефона (только цифры или любой формат)
 * @param defaultCountry - страна по умолчанию для парсинга (по умолчанию RU)
 * @returns отформатированный номер или исходная строка
 */
export function formatPhone(phone: string | number | null | undefined, defaultCountry: CountryCode = 'RU'): string {
    if (phone === null || phone === undefined || phone === '') {
        return '';
    }
    
    const phoneStr = String(phone);
    
    // Если номер пустой после очистки — вернуть пустую строку
    if (!phoneStr.trim()) {
        return '';
    }
    
    try {
        // Добавляем + если номер начинается с цифры и содержит только цифры
        const digits = phoneStr.replace(/\D/g, '');
        const phoneWithPlus = digits === phoneStr ? '+' + digits : phoneStr;
        
        // Пробуем распарсить
        const parsed = parsePhoneNumber(phoneWithPlus, defaultCountry);
        
        if (parsed && isValidPhoneNumber(phoneWithPlus, defaultCountry)) {
            // NATIONAL формат: (952) 484-80-41
            // INTERNATIONAL формат: +7 952 484 80 41
            // Используем formatNational для локального формата с добавлением кода страны
            const national = parsed.formatNational();
            return `+${parsed.countryCallingCode} ${national}`;
        }
        
        // Если невалидный номер — пробуем хотя бы частичное форматирование
        if (parsed) {
            return parsed.formatInternational();
        }
    } catch (e) {
        // Ошибка парсинга — вернём как есть
    }
    
    // Форматирование не удалось — возвращаем исходное значение
    return phoneStr;
}

/**
 * Нормализация данных участника - обработка телефонных полей.
 * 
 * @param data - данные участника
 * @param phoneFieldKeys - ключи полей с типом isPhone: true
 * @returns данные с нормализованными телефонами
 */
export function normalizeParticipantPhones(
    data: Record<string, any>,
    phoneFieldKeys: string[]
): Record<string, any> {
    if (!phoneFieldKeys || phoneFieldKeys.length === 0) {
        return data;
    }
    
    const result = { ...data };
    
    for (const key of phoneFieldKeys) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
            result[key] = normalizePhone(result[key]);
        }
    }
    
    return result;
}

/**
 * Форматирование данных участника для экспорта - обработка телефонных полей.
 * 
 * @param data - данные участника
 * @param phoneFieldKeys - ключи полей с типом isPhone: true
 * @returns данные с отформатированными телефонами
 */
export function formatParticipantPhones(
    data: Record<string, any>,
    phoneFieldKeys: string[]
): Record<string, any> {
    if (!phoneFieldKeys || phoneFieldKeys.length === 0) {
        return data;
    }
    
    const result = { ...data };
    
    for (const key of phoneFieldKeys) {
        if (result[key] !== undefined && result[key] !== null && result[key] !== '') {
            result[key] = formatPhone(result[key]);
        }
    }
    
    return result;
}

/**
 * Получить ключи полей с флагом isPhone из схемы
 * 
 * @param fields - схема проекта
 * @returns массив ключей телефонных полей
 */
export function getPhoneFieldKeys(fields: { key: string; config: { type?: string; isPhone?: boolean } }[]): string[] {
    return fields
        .filter(f => f.config.type === 'text' && f.config.isPhone === true)
        .map(f => f.key);
}
