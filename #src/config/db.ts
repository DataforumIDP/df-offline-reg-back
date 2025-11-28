import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_ENV_NAME as string,
  process.env.DB_ENV_USER as string,
  process.env.DB_ENV_PASSWORD,
  {
    host: process.env.DB_ENV_HOST,
    port: parseInt(process.env.DB_ENV_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  }
);

export default sequelize;
