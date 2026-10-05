const MIGRATION_TARGETS = ['development', 'test', 'production'];
const REQUIRED_MIGRATION_USER = 'postgres';

const REQUIRED_KEYS = [
  'DB_MIGRATION_USER',
  'DB_MIGRATION_PASSWORD',
  'DB_MIGRATION_HOST',
  'DB_MIGRATION_PORT',
  'DB_MIGRATION_NAME',
];

function requiredValue(environment, key) {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`MIGRATION_CONFIG: ${key} is required`);
  }
  return value.trim();
}

function validateTarget(target) {
  if (!MIGRATION_TARGETS.includes(target)) {
    throw new Error(
      `MIGRATION_CONFIG: target must be exactly one of ${MIGRATION_TARGETS.join(', ')}`
    );
  }
}

function buildUnifiedMigrationConfig(environment, target, commonConfig = {}) {
  validateTarget(target);
  const values = Object.fromEntries(
    REQUIRED_KEYS.map(key => [key, requiredValue(environment, key)])
  );

  if (values.DB_MIGRATION_USER !== REQUIRED_MIGRATION_USER) {
    throw new Error(
      'MIGRATION_CONFIG: DB_MIGRATION_USER must be exactly postgres for the immutable migration lineage'
    );
  }
  if (!/^\d+$/.test(values.DB_MIGRATION_PORT)) {
    throw new Error('MIGRATION_CONFIG: DB_MIGRATION_PORT must be an explicit numeric port');
  }
  const port = Number(values.DB_MIGRATION_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MIGRATION_CONFIG: DB_MIGRATION_PORT must be an explicit numeric port');
  }

  if (target === 'test' && values.DB_MIGRATION_NAME !== 'jupiter_test') {
    throw new Error('MIGRATION_CONFIG: test target database must be exactly jupiter_test');
  }
  if (target !== 'test' && values.DB_MIGRATION_NAME === 'jupiter_test') {
    throw new Error(
      `MIGRATION_CONFIG: ${target} target must not use the jupiter_test database`
    );
  }

  return {
    ...commonConfig,
    username: values.DB_MIGRATION_USER,
    password: values.DB_MIGRATION_PASSWORD,
    database: values.DB_MIGRATION_NAME,
    host: values.DB_MIGRATION_HOST,
    port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: { searchPath: 'public' },
    define: { schema: 'public' },
  };
}

module.exports = {
  MIGRATION_TARGETS,
  REQUIRED_MIGRATION_USER,
  buildUnifiedMigrationConfig,
};
