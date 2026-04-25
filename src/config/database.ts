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
// SEQUELIZE CONFIGURATION (for CLI)
// ----------------------------

export const sequelizeConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  dialect: 'postgres' as const,
  logging: false,

  // 🔥 CRITICAL FIX
  dialectOptions: {
    options: {
      searchPath: 'public',
    },
  },

  define: {
    schema: 'public',
  },
};

// ----------------------------
// SEQUELIZE INSTANCE (for app)
// ----------------------------

const sequelize = new Sequelize({
  username: process.env.DB_USER as string,
  password: process.env.DB_PASSWORD as string,
  database: process.env.DB_NAME as string,
  host: process.env.DB_HOST as string,
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,

  dialectOptions: {
    searchPath: 'public', // ✅ correct
  },

  define: {
    schema: 'public',
  },
});

// Export instance
export default sequelize;