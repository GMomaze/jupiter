import { describe, expect, it } from 'vitest';
import {
  FIRST_ORGANISATION_SAFETY_ERROR,
  parseFirstOrganisationTarget,
  validateFirstOrganisationLiveIdentity,
  validateFirstOrganisationProvisioningConfiguration,
} from './firstOrganisationProvisioningSafety.js';

const base = (): NodeJS.ProcessEnv => ({
  ALLOW_FIRST_ORGANISATION_PROVISIONING: 'YES',
  CONFIRM_FIRST_ORGANISATION_TARGET: 'test',
  FIRST_ORGANISATION_ACTOR_USER_ID: '00000000-0000-4000-8000-000000000001',
  FIRST_ORGANISATION_INITIAL_USER_ID: '00000000-0000-4000-8000-000000000002',
  FIRST_ORGANISATION_CODE: ' first org ',
  CONFIRM_FIRST_ORGANISATION_CODE: 'FIRST_ORG',
  FIRST_ORGANISATION_DISPLAY_NAME: 'First Organisation',
  DB_NAME: 'jupiter_test', DB_USER: 'jupiter_test', DB_PASSWORD: 'x',
  DB_HOST: '127.0.0.1', DB_PORT: '5432',
});

describe('first Organisation provisioning safety', () => {
  it('accepts only exact targets', () => {
    expect(parseFirstOrganisationTarget('test')).toBe('test');
    expect(parseFirstOrganisationTarget('production')).toBe('production');
    expect(() => parseFirstOrganisationTarget('development')).toThrow(FIRST_ORGANISATION_SAFETY_ERROR);
  });

  it.each([undefined, '', 'yes', 'TRUE'])('rejects non-exact approval %s', approval => {
    const environment = base();
    if (approval === undefined) delete environment.ALLOW_FIRST_ORGANISATION_PROVISIONING;
    else environment.ALLOW_FIRST_ORGANISATION_PROVISIONING = approval;
    expect(() => validateFirstOrganisationProvisioningConfiguration('test', environment)).toThrow(FIRST_ORGANISATION_SAFETY_ERROR);
  });

  it('requires exact target and normalized-code confirmations plus UUID identities', () => {
    expect(validateFirstOrganisationProvisioningConfiguration('test', base())).toMatchObject({ code: 'FIRST_ORG' });
    for (const key of ['CONFIRM_FIRST_ORGANISATION_TARGET', 'CONFIRM_FIRST_ORGANISATION_CODE', 'FIRST_ORGANISATION_ACTOR_USER_ID']) {
      const environment = base(); delete environment[key];
      expect(() => validateFirstOrganisationProvisioningConfiguration('test', environment)).toThrow(FIRST_ORGANISATION_SAFETY_ERROR);
    }
  });

  it('separates test and production and adds a production-only approval', () => {
    expect(() => validateFirstOrganisationProvisioningConfiguration('production', base())).toThrow(FIRST_ORGANISATION_SAFETY_ERROR);
    const environment = { ...base(), CONFIRM_FIRST_ORGANISATION_TARGET: 'production', DB_NAME: 'jupiter_db', DB_USER: 'jupiter_app', ALLOW_FIRST_ORGANISATION_PRODUCTION: 'YES' };
    expect(validateFirstOrganisationProvisioningConfiguration('production', environment)).toMatchObject({ target: 'production', database: 'jupiter_db', username: 'jupiter_app' });
  });

  it('requires exact writable runtime identity and endpoint', () => {
    const config = validateFirstOrganisationProvisioningConfiguration('test', base());
    const identity = { database_name: 'jupiter_test', current_user: 'jupiter_test', session_user: 'jupiter_test', server_address: '127.0.0.1', server_port: 5432, transaction_read_only: 'off' };
    expect(() => validateFirstOrganisationLiveIdentity(config, identity, ['127.0.0.1'])).not.toThrow();
    expect(() => validateFirstOrganisationLiveIdentity(config, { ...identity, database_name: 'jupiter_db' }, ['127.0.0.1'])).toThrow(FIRST_ORGANISATION_SAFETY_ERROR);
  });
});
