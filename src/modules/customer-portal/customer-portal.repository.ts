import type { CustomerPortalQueryAuthority } from './customer-portal-query-authority.js';

export const CUSTOMER_PORTAL_VISIBLE_RELATIONSHIP_TYPES = [
  'OWNER',
  'CO_OWNER',
  'OPERATOR',
  'MANAGEMENT_COMPANY',
] as const;

export type CustomerPortalIdentity = Readonly<{
  customerUserId: string;
  customerId: string;
  tenantId: string;
  email: string;
  displayName: string;
  customerName: string;
}>;

export type CustomerPortalAircraftRow = Readonly<{
  id: string;
  registration: string;
  serialNumber: string | null;
  modelName: string | null;
  manufacturerName: string | null;
  relationshipType: string;
}>;

export type CustomerPortalWorkpackRow = Readonly<{
  id: string;
  workOrderNumber: string;
  createdAt: Date | string | null;
  certifiedAt: Date | string | null;
  qaReviewedAt: Date | string | null;
  releasedAt: Date | string | null;
  aircraftRegistration: string;
  statusCode: string | null;
  statusLabel: string | null;
  relationshipType: string;
}>;

export type CustomerPortalDocumentRow = Readonly<{
  workpackId: string;
  workOrderNumber: string;
  createdAt: Date | string | null;
  releasedAt: Date | string;
  aircraftRegistration: string;
}>;

export type CustomerPortalComplianceRow = Readonly<{
  workpackId: string;
  complianceItemId: string;
  aircraftRegistration: string;
  itemType: 'AD' | 'SB';
  referenceCode: string;
  title: string;
  completedAt: Date | string | null;
}>;

export interface CustomerPortalRepository {
  resolveIdentity(customerUserId: string): Promise<CustomerPortalIdentity | undefined>;
  getIdentity(authority: CustomerPortalQueryAuthority): Promise<CustomerPortalIdentity | undefined>;
  listAircraft(authority: CustomerPortalQueryAuthority): Promise<readonly CustomerPortalAircraftRow[]>;
  listWorkpacks(authority: CustomerPortalQueryAuthority): Promise<readonly CustomerPortalWorkpackRow[]>;
  listReleasedDocuments(authority: CustomerPortalQueryAuthority): Promise<readonly CustomerPortalDocumentRow[]>;
  listCompletedCompliance(authority: CustomerPortalQueryAuthority): Promise<readonly CustomerPortalComplianceRow[]>;
}
