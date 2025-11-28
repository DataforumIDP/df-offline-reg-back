import { Model, DataTypes } from "sequelize";
import sequelize from "../config/db";
import bcrypt from "bcrypt";
import { adminRoles, allRoles, operatorRoles } from "../datas/rolesData";

class Accounts extends Model {
    public id!: number;
    public login!: string;
    public name!: string;
    public password!: string;
    public role!: string;

    public isDelete!: boolean;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            login: this.login,
            role: this.role,
        };
    }

    get isAdmin() {
        return adminRoles.includes(this.role)
    }

    public async validPassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password);
    }
}

Accounts.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        login: {
            type: DataTypes.STRING(128),
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING(256),
            allowNull: false,
            validate: {
                notEmpty: true,
            },
        },
        name: {
            type: DataTypes.STRING(256),
            allowNull: true,
            defaultValue: "Новый пользователь"
        },
        role: {
            type: DataTypes.STRING(256),
            allowNull: false,
            validate: {
                isIn: [allRoles]
            },
            defaultValue: operatorRoles[0],
        },
        isDelete: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        }
    },
    {
        sequelize,
        tableName: "accounts",
        timestamps: true,
    }
);

Accounts.beforeCreate(async (account: Accounts) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    account.password = await bcrypt.hash(account.password, salt);
    account.login = account.login.toLowerCase();
});

Accounts.beforeUpdate(async (account: Accounts) => {
    if (account.changed("password")) {
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds);
        account.password = await bcrypt.hash(account.password, salt);
    }
});

// Accounts.findOrCreate({
//     where: { login: 'admin@neksys.ru' },
//     defaults: {
//         password: "secret",
//         role: "admin",
//     },
// });

export default Accounts;
