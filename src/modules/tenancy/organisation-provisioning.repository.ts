import type {
  ProvisionOrganisationInput,
  ProvisionOrganisationResult,
} from './organisation-provisioning.contracts.js';

export interface ProvisioningSqlResult<Row = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}

export interface ProvisioningSqlExecutor {
  query<Row = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[],
  ): Promise<ProvisioningSqlResult<Row>>;
}

export interface ProvisioningTransactionAuthority {
  transaction<Result>(
    work: (transaction: ProvisioningSqlExecutor) => Promise<Result>,
  ): Promise<Result>;
}

export interface OrganisationProvisioningDependencies {
  readonly database: ProvisioningTransactionAuthority;
  readonly ids: () => unknown;
  readonly clock: () => Date;
}

export const ORGANISATION_PROVISIONING_ERROR = 'Organisation provisioning failed.';

/** Fail-closed compatibility boundary for the superseded pre-Level-3 writer. */
export class OrganisationProvisioningRepository {
  constructor(_dependencies: OrganisationProvisioningDependencies) {}

  async provision(_input: ProvisionOrganisationInput): Promise<ProvisionOrganisationResult> {
    throw new Error('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
  }
}
