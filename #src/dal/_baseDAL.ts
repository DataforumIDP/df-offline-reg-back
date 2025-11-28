import { Model, ModelStatic, Op } from "sequelize";

export class BaseDAL<T extends Model> {
    protected model: ModelStatic<T>;

    constructor(model: ModelStatic<T>) {
        this.model = model;
    }

    create(data: any) {
        return this.model.create(data, { returning: true });
    }

    updateOne(entity: T, params: any) {
        return entity.update(params, { returning: true });
    }

    updateMany(entityIds: number[], params: any) {
        const where = { id: { [Op.in]: entityIds } };        

        return this.model.update(params, {
            where,
            returning: true,
        });
    }

    updateByConditions(consditions: any, params: any) {
        return this.model.update(params, {
            where: consditions,
            returning: true,
        });
    }



    addDeleteConditions(
        whereConditions: any[]
    ) {
        whereConditions.push({
            isDelete: false,
        });

        return whereConditions;
    }
    addDateConditions(
        params: { dateRange?: string[] },
        whereConditions: any[]
    ) {
        const { dateRange } = params;


        if (dateRange) {
            const [startDate, endDate] = dateRange;

            if (startDate && !endDate) {
                // Если передана только одна дата
                const startOfDay = new Date(startDate);
                startOfDay.setUTCHours(0, 0, 0, 0);

                const endOfDay = new Date(startDate);
                endOfDay.setUTCHours(23, 59, 59, 999);

                whereConditions.push({
                    pubDate: {
                        [Op.between]: [
                            startOfDay.toISOString(),
                            endOfDay.toISOString(),
                        ],
                    },
                });
            } else if (startDate && endDate) {
                // Если переданы обе даты
                whereConditions.push({
                    pubDate: {
                        [Op.between]: [startDate, endDate],
                    },
                });
            }
        }

        return whereConditions;
    }

    _get(params: any) {
        let {
            whereConditions,
            search = "",
            limit = 20,
            offset,
            include,
            order = [["createdAt", "DESC"]],
        } = params;

        const replacements = { searchQuery: search };
        const where = {
            [Op.and]: this.addDeleteConditions(whereConditions),
        };                

        return [
            this.model.findAll({
                where,
                replacements,
                order,
                limit,
                offset,
                include,
            }),
            this.model.findAll({
                where,
                replacements,
            }),
        ];
    }

    findByPk(pk: any) {
        return this.model.findByPk(pk);
    }

    findOne(where: any) {
        where.isDelete = false
        return this.model.findOne({ where });
    }

    _delete(ids: any[]) {
        return this.updateMany(ids, { isDelete: true });
    }

    // Вы можете добавить другие общие методы здесь
}
