// Типы полей схемы проекта
export type ProjectFieldType = 'text' | 'list' | 'bool' | 'id' | 'img' | 'code';

// Элемент списка для типа list
export interface ListItem {
    value: string;
    color: string; // HEX string
}

// Настройки списка
export interface ListSettings {
    multiple: boolean;
    items: ListItem[];
}

// Конфигурация поля
export interface ProjectFieldConfig {
    type: ProjectFieldType;
    uniq: boolean;
    optional: boolean; // true = необязательное поле, false = обязательное
    /** Значение по умолчанию для необязательных полей */
    defaultValue?: any | null;
    maxLength?: number;
    listSettings?: ListSettings;
    random?: boolean; // true = генерировать случайные значения
}

// Интерфейс поля проекта
export interface ProjectField {
    id: number;
    project_id: number;
    label: string;
    key: string;
    config: ProjectFieldConfig;
    scanner_editable: boolean; // Можно редактировать через сканер (только для checkbox)
    is_delete: boolean;
    created_at: Date;
    updated_at: Date;
}

// Хелпер для работы с полями проекта
export class ProjectFieldHelper {
    static toJSON(field: ProjectField) {
        return {
            id: field.id,
            projectId: field.project_id,
            label: field.label,
            key: field.key,
            config: field.config,
            scannerEditable: field.scanner_editable ?? false,
        };
    }

    // Валидация конфигурации поля
    static validateConfig(config: ProjectFieldConfig): { valid: boolean; error?: string } {
        const validTypes: ProjectFieldType[] = ['text', 'list', 'bool', 'id', 'img', 'code'];
        
        if (!validTypes.includes(config.type)) {
            return { valid: false, error: `Недопустимый тип поля: ${config.type}` };
        }

        if (typeof config.uniq !== 'boolean') {
            return { valid: false, error: 'Поле uniq должно быть boolean' };
        }

        if (typeof config.optional !== 'boolean') {
            return { valid: false, error: 'Поле optional должно быть boolean' };
        }

        if (config.maxLength !== undefined && (typeof config.maxLength !== 'number' || config.maxLength < 1)) {
            return { valid: false, error: 'maxLength должен быть положительным числом' };
        }

        // Валидация listSettings для типа list
        if (config.type === 'list') {
            if (!config.listSettings) {
                return { valid: false, error: 'Для типа list обязательны listSettings' };
            }

            if (typeof config.listSettings.multiple !== 'boolean') {
                return { valid: false, error: 'listSettings.multiple должен быть boolean' };
            }

            if (!Array.isArray(config.listSettings.items)) {
                return { valid: false, error: 'listSettings.items должен быть массивом' };
            }

            for (const item of config.listSettings.items) {
                if (!item.value || typeof item.value !== 'string') {
                    return { valid: false, error: 'Каждый элемент списка должен иметь value типа string' };
                }
                if (!item.color || !/^#[0-9A-Fa-f]{6}$/.test(item.color)) {
                    return { valid: false, error: 'Цвет должен быть в формате HEX (#RRGGBB)' };
                }
            }
        }

        // Валидация defaultValue (если указан)
        if ((config as any).defaultValue !== undefined) {
            const dv = (config as any).defaultValue
            if (dv !== null) {
                switch (config.type) {
                    case 'bool':
                        if (typeof dv !== 'boolean') return { valid: false, error: 'defaultValue для bool должен быть boolean или null' };
                        break;
                    case 'list':
                        if (!config.listSettings) return { valid: false, error: 'listSettings required for list type' };
                        if (config.listSettings.multiple) {
                            if (!Array.isArray(dv)) return { valid: false, error: 'defaultValue для множественного list должен быть массивом' };
                        } else {
                            if (typeof dv !== 'string') return { valid: false, error: 'defaultValue для list должен быть строкой' };
                            if (config.listSettings.items && !config.listSettings.items.find(i => i.value === dv)) {
                                return { valid: false, error: 'defaultValue не найден в items списка' };
                            }
                        }
                        break;
                    case 'text':
                    case 'id':
                    case 'img':
                    case 'code':
                        if (typeof dv !== 'string') return { valid: false, error: `defaultValue для типа ${config.type} должен быть строкой` };
                        if (config.maxLength && typeof dv === 'string' && dv.length > config.maxLength) return { valid: false, error: 'defaultValue превышает maxLength' };
                        break;
                    default:
                        break;
                }
            }
        }

        // Добавляем проверку для нового флага random
        if (config.random) {
            if (config.type !== 'code') {
                return { valid: false, error: 'Флаг random можно использовать только для типа code' };
            }
        }

        return { valid: true };
    }

    // Проверка, можно ли редактировать поле
    static isEditable(config: ProjectFieldConfig): boolean {
        return config.type === 'list';
    }

    // Генерация ключа из label
    static generateKey(label: string): string {
        return label
            .toLowerCase()
            .replace(/[а-яё]/gi, (char) => {
                const ru = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
                const en = 'abvgdeejzijklmnoprstufhcchshsch_y_eua';
                const index = ru.indexOf(char.toLowerCase());
                return index >= 0 ? en[index] : char;
            })
            .replace(/[^a-z0-9]/gi, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    // Метод для генерации случайного значения из 20 символов
    static generateRandomValue(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 20; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
