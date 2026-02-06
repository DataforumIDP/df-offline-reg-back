import { BaseDAL } from "./_baseDAL";
import { _offset } from "../utils/getOffset";

export class ProjectsDAL extends BaseDAL {
    constructor() {
        super('projects');
    }

    async getBySlug(slug: string) {
        return await this.db(this.tableName)
            .where({ slug })
            .where({ isDelete: false })
            .first();
    }

    async getBySlugOrId(slugOrId: string | number) {
        const query = this.db(this.tableName)
            .where({ isDelete: false });

        // Проверяем, является ли параметр числом
        if (!isNaN(Number(slugOrId))) {
            query.where({ id: Number(slugOrId) });
        } else {
            query.where({ slug: slugOrId });
        }

        return await query.first();
    }

    async get(params: any) {
        const { page, search, limit, dateStart, dateEnd } = params;

        const offset = _offset(page, limit);

        let query = this.db(this.tableName)
            .where({ isDelete: false });

        let countQuery = this.db(this.tableName)
            .where({ isDelete: false });

        // Поиск по title, description, slug с учетом раскладки
        if (search) {
            const invertedSearch = this.invertKeyboardLayout(search);
            
            query = query.where(function() {
                this.where('title', 'ilike', `%${search}%`)
                    .orWhere('description', 'ilike', `%${search}%`)
                    .orWhere('slug', 'ilike', `%${search}%`)
                    .orWhere('title', 'ilike', `%${invertedSearch}%`)
                    .orWhere('description', 'ilike', `%${invertedSearch}%`)
                    .orWhere('slug', 'ilike', `%${invertedSearch}%`);
            });

            countQuery = countQuery.where(function() {
                this.where('title', 'ilike', `%${search}%`)
                    .orWhere('description', 'ilike', `%${search}%`)
                    .orWhere('slug', 'ilike', `%${search}%`)
                    .orWhere('title', 'ilike', `%${invertedSearch}%`)
                    .orWhere('description', 'ilike', `%${invertedSearch}%`)
                    .orWhere('slug', 'ilike', `%${invertedSearch}%`);
            });
        }

        // Фильтр по датам
        if (dateStart && dateEnd) {
            // Между двумя датами
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999); // Конец дня

            query = query.where('dateStart', '>=', start).where('dateEnd', '<=', end);
            countQuery = countQuery.where('dateStart', '>=', start).where('dateEnd', '<=', end);
        } else if (dateStart) {
            // Все события в указанный день
            const start = new Date(dateStart);
            const end = new Date(dateStart);
            end.setHours(23, 59, 59, 999);

            query = query.where('dateStart', '>=', start).where('dateStart', '<=', end);
            countQuery = countQuery.where('dateStart', '>=', start).where('dateStart', '<=', end);
        }

        query = query
            .orderBy('dateStart', 'desc')
            .limit(limit || 20)
            .offset(offset);

        countQuery = countQuery.count('* as count');

        const [data, countResult] = await Promise.all([
            query,
            countQuery,
        ]);

        const total = parseInt((countResult[0] as any).count, 10);

        return [data, { total }];
    }

    async findByPk(id: number) {
        return await this.db(this.tableName)
            .where({ id, isDelete: false })
            .first();
    }

    // Инвертирование раскладки клавиатуры RU <-> EN
    private invertKeyboardLayout(text: string): string {
        const ruToEn: Record<string, string> = {
            'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p',
            'х': '[', 'ъ': ']', 'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k',
            'д': 'l', 'ж': ';', 'э': '\'', 'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm',
            'б': ',', 'ю': '.', 'ё': '`',
        };

        const enToRu: Record<string, string> = {
            'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з',
            '[': 'х', ']': 'ъ', 'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л',
            'l': 'д', ';': 'ж', '\'': 'э', 'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь',
            ',': 'б', '.': 'ю', '`': 'ё',
        };

        let result = '';
        for (const char of text.toLowerCase()) {
            if (ruToEn[char]) {
                result += ruToEn[char];
            } else if (enToRu[char]) {
                result += enToRu[char];
            } else {
                result += char;
            }
        }

        return result;
    }
}
