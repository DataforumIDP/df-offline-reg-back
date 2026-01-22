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
    maxLength?: number;
    listSettings?: ListSettings;
}

// Интерфейс поля проекта
export interface ProjectField {
    id: number;
    project_id: number;
    label: string;
    key: string;
    config: ProjectFieldConfig;
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
}
