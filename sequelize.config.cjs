const path = require('path');
const dotenv = require('dotenv');
const {
  buildGovernanceRepairConfig,
} = require('./sequelize-governance-repair-config.cjs');

const databaseEnvironmentKeys = [
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'DB_ADMIN_USER',
  'DB_ADMIN_PASSWORD',
  'DATABASE_URL',
  'ALLOW_TEST_DATABASE_RESET',
];

if (process.env.NODE_ENV === 'test') {
  for (const key of databaseEnvironmentKeys) {
    delete process.env[key];
  }

  dotenv.config({
    path: path.resolve(__dirname, '.env.test'),
    override: true,
    quiet: true,
  });
} else {
  dotenv.config({ quiet: true });
}

const databaseConfig = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    searchPath: 'public',
  },
  define: {
    schema: 'public',
  },
};

const configurations = {
  development: { ...databaseConfig },
  test: { ...databaseConfig },
  production: { ...databaseConfig },
};

Object.defineProperty(configurations, 'production-governance-repair', {
  enumerable: true,
  get() {
    return buildGovernanceRepairConfig(process.env, databaseConfig);
  },
});

module.exports = configurations;
