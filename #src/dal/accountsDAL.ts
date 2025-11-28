import { Op } from "sequelize";
import Accounts from "../models/accounts";
import { BaseDAL } from "./_baseDAL";
import { _offset } from "../utils/getOffset";

export class AccountsDAL extends BaseDAL<Accounts> {
    constructor() {
        super(Accounts);
    }

    getByLoginAndRoles(login: string, roles: string[], isDelete?: boolean) {     

        const cond: any[] = [
            {
                login,
                role: {
                    [Op.in]: roles,
                },
            },
        ];

        if (isDelete !== undefined) cond.push({ isDelete });

        return this.findOne({
            [Op.and]: cond,
        });
    }

    get(params: any) {
        const { page, search, limit } = params;

        const offset = _offset(page, limit);

        const whereConditions: any[] = [];

        if (search) {
            whereConditions.push({
                [Op.or]: [
                    {
                        name: { [Op.iLike]: `%${search}%` },
                    },
                    {
                        login: { [Op.iLike]: `%${search}%` },
                    },
                    {
                        role: { [Op.iLike]: `%${search}%` },
                    },
                ],
            });
        }

        return this._get({
            whereConditions,
            search,
            limit: limit || 20,
            offset,
        });
    }
}
