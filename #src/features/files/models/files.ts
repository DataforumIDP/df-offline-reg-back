import { Model, DataTypes } from "sequelize";
import sequelize from "../../../config/db";

class Files extends Model {
    public id!: number;
    public url!: string;
    public name!: string;
    public type!: string;

    public isDelete!: boolean;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            url: this.url,
            type: this.type,
            createdAt: this.createdAt,
        };
    }
}

Files.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: "Новый файл",
        },
        url: {
            type: DataTypes.STRING(500),
            allowNull: false,
            defaultValue: "xxx.png",
        },
        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: "png",
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
        },
    },
    {
        sequelize,
        tableName: "files",
        timestamps: true,
    }
);

export default Files;
