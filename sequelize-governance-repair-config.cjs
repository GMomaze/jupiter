const REQUIRED_KEYS = [
  'DB_ADMIN_USER',
  'DB_ADMIN_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
];

function requiredValue(environment, key) {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`GOVERNANCE_REPAIR_CONFIG: ${key} is required`);
  }
  return value.trim();
}

function buildGovernanceRepairConfig(environment, ordinaryConfig) {
  const values = Object.fromEntries(
    REQUIRED_KEYS.map(key => [key, requiredValue(environment, key)])
  );
  if (values.DB_NAME !== 'jupiter_db') {
    throw new Error('GOVERNANCE_REPAIR_CONFIG: DB_NAME must be exactly jupiter_db');
  }
  const runtimeUser =
    typeof environment.DB_USER === 'string' ? environment.DB_USER.trim() : '';
  if (
    values.DB_ADMIN_USER === 'jupiter_app' ||
    values.DB_ADMIN_USER === 'jupiter_test' ||
    (runtimeUser.length > 0 && values.DB_ADMIN_USER === runtimeUser)
  ) {
    throw new Error(
      'GOVERNANCE_REPAIR_CONFIG: DB_ADMIN_USER must be a dedicated administrator identity'
    );
  }
  if (!/^\d+$/.test(values.DB_PORT)) {
    throw new Error('GOVERNANCE_REPAIR_CONFIG: DB_PORT must be an explicit numeric port');
  }
  const port = Number(values.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('GOVERNANCE_REPAIR_CONFIG: DB_PORT must be an explicit numeric port');
  }

  return {
    ...ordinaryConfig,
    username: values.DB_ADMIN_USER,
    password: values.DB_ADMIN_PASSWORD,
    database: values.DB_NAME,
    host: values.DB_HOST,
    port,
  };
}

module.exports = { buildGovernanceRepairConfig };
