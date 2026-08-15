import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildGovernanceRepairConfig } = require(
  '../../sequelize-governance-repair-config.cjs'
) as {
  buildGovernanceRepairConfig: (
    environment: Record<string, string | undefined>,
    ordinaryConfig: Record<string, unknown>
  ) => Record<string, unknown>;
};

const approved = {
  DB_ADMIN_USER: 'jupiter_migration_admin',
  DB_ADMIN_PASSWORD: 'not-a-real-secret',
  DB_HOST: 'database.internal',
  DB_PORT: '5432',
  DB_NAME: 'jupiter_db',
  DB_USER: 'jupiter_app',
};

describe('production governance repair configuration', () => {
  it.each([
    'DB_ADMIN_USER',
    'DB_ADMIN_PASSWORD',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
  ])('rejects missing, empty, and whitespace-only %s before connection creation', key => {
    for (const value of [undefined, '', '   ']) {
      expect(() =>
        buildGovernanceRepairConfig({ ...approved, [key]: value }, {})
      ).toThrow(`GOVERNANCE_REPAIR_CONFIG: ${key} is required`);
    }
  });

  it('requires the exact production database name', () => {
    expect(() =>
      buildGovernanceRepairConfig({ ...approved, DB_NAME: 'jupiter_test' }, {})
    ).toThrow('DB_NAME must be exactly jupiter_db');
  });

  it.each(['jupiter_app', 'jupiter_test', 'ordinary_runtime'])(
    'rejects unsafe administrator identity %s',
    adminUser => {
      expect(() =>
        buildGovernanceRepairConfig(
          { ...approved, DB_USER: 'ordinary_runtime', DB_ADMIN_USER: adminUser },
          {}
        )
      ).toThrow('DB_ADMIN_USER must be a dedicated administrator identity');
    }
  );

  it.each(['not-a-port', '0', '65536'])(
    'rejects invalid explicit port %s',
    port => {
      expect(() =>
        buildGovernanceRepairConfig({ ...approved, DB_PORT: port }, {})
      ).toThrow('DB_PORT must be an explicit numeric port');
    }
  );

  it('returns only explicit administrator connection identity values', () => {
    expect(buildGovernanceRepairConfig(approved, { dialect: 'postgres' })).toEqual({
      dialect: 'postgres',
      username: 'jupiter_migration_admin',
      password: 'not-a-real-secret',
      database: 'jupiter_db',
      host: 'database.internal',
      port: 5432,
    });
  });
});
