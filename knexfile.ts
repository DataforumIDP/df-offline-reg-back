import type { Knex } from "knex";
import * as dotenv from 'dotenv';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_ENV_HOST,
      port: parseInt(process.env.DB_ENV_PORT || '5432'),
      database: process.env.DB_ENV_NAME,
      user: process.env.DB_ENV_USER,
      password: process.env.DB_ENV_PASSWORD,
    },
    migrations: {
      directory: './migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_ENV_HOST,
      port: parseInt(process.env.DB_ENV_PORT || '5432'),
      database: process.env.DB_ENV_NAME,
      user: process.env.DB_ENV_USER,
      password: process.env.DB_ENV_PASSWORD,
    },
    migrations: {
      directory: './migrations',
      extension: 'ts'
    },
    seeds: {
      directory: './seeds',
    },
  }
};

module.exports = config;