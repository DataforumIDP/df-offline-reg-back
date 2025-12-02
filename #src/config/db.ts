import knex, { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const config: Knex.Config = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_ENV_HOST || 'localhost',
    port: parseInt(process.env.DB_ENV_PORT || '5432', 10),
    database: process.env.DB_ENV_NAME,
    user: process.env.DB_ENV_USER,
    password: process.env.DB_ENV_PASSWORD,
  },
  pool: {
    min: 2,
    max: 10,
  },
  acquireConnectionTimeout: 10000,
  migrations: {
    tableName: 'knex_migrations',
    directory: path.join(__dirname, '../../migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.join(__dirname, '../../seeds'),
    extension: 'ts',
  },
};

export const db = knex(config);

export default db;
