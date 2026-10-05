export interface ProvisionOrganisationInput {
  readonly actorUserId: string;
  readonly initialUserId: string;
  readonly code: string;
  readonly displayName: string;
  readonly legalName?: string | null;
}

export interface ProvisionedOrganisationIdentity {
  readonly tenantId: string;
  readonly tenantPublicId: string;
  readonly membershipId: string;
}

export type ProvisionOrganisationResult =
  | Readonly<{ outcome: 'CREATED'; organisation: ProvisionedOrganisationIdentity }>
  | Readonly<{ outcome: 'EXISTING'; organisation: ProvisionedOrganisationIdentity }>
  | Readonly<{ outcome: 'CONFLICT'; message: 'Organisation unavailable' }>;
