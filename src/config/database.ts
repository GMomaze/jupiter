import pg from 'pg';
import { Sequelize } from 'sequelize';
import 'dotenv/config';

const { Pool } = pg;

// ----------------------------
// PG POOLS (keep as-is)
// ----------------------------

const appConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
};

const adminConfig = {
  ...appConfig,
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
};

export const pool = new Pool(appConfig);
export const adminPool = new Pool(adminConfig);

// ----------------------------
// SEQUELIZE INSTANCE (NEW)
// ----------------------------

const sequelize = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: 'postgres',
    logging: false,
  }
);

export default sequelize;
