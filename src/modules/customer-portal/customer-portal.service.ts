import { assertCustomerPortalQueryAuthority, type CustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import { customerPortalRepository } from './customer-portal.repository.live.js';
import type { CustomerPortalRepository } from './customer-portal.repository.js';

export class CustomerPortalService {
  constructor(private readonly repository: CustomerPortalRepository = customerPortalRepository) {}

  async getIdentity(authority: CustomerPortalQueryAuthority) {
    assertCustomerPortalQueryAuthority(authority);
    return this.repository.getIdentity(authority);
  }

  async listAircraft(authority: CustomerPortalQueryAuthority) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await this.repository.listAircraft(authority);
    const aircraft = new Map<string, {
      id: string; registration: string; serialNumber: string | null;
      modelName: string | null; manufacturerName: string | null; relationshipTypes: string[];
    }>();
    for (const row of rows) {
      const existing = aircraft.get(row.id);
      if (existing) {
        if (!existing.relationshipTypes.includes(row.relationshipType)) {
          existing.relationshipTypes.push(row.relationshipType);
        }
      } else {
        aircraft.set(row.id, {
          id: row.id,
          registration: row.registration,
          serialNumber: row.serialNumber,
          modelName: row.modelName,
          manufacturerName: row.manufacturerName,
          relationshipTypes: [row.relationshipType],
        });
      }
    }
    return [...aircraft.values()];
  }

  async listWorkpacks(authority: CustomerPortalQueryAuthority) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await this.repository.listWorkpacks(authority);
    return rows.map((row) => ({
      id: row.id,
      identifier: row.workOrderNumber,
      workOrderNumber: row.workOrderNumber || null,
      aircraftRegistration: row.aircraftRegistration,
      title: `Workpack ${row.workOrderNumber}`,
      description: 'Customer-safe maintenance workpack summary',
      status: String(row.statusLabel || '').trim() || String(row.statusCode || '').trim() || 'Unknown',
      relationshipType: row.relationshipType,
      openedAt: row.createdAt,
      closedAt: row.releasedAt || row.certifiedAt || row.qaReviewedAt || null,
    }));
  }

  async listReleasedDocuments(authority: CustomerPortalQueryAuthority) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await this.repository.listReleasedDocuments(authority);
    return rows.map((row) => ({
      id: `release-summary:${row.workpackId}`,
      title: `Release Summary for Workpack ${row.workOrderNumber}`,
      documentType: 'RELEASE_SUMMARY',
      aircraftRegistration: row.aircraftRegistration,
      workpackReference: row.workOrderNumber || null,
      createdAt: row.createdAt,
      releasedAt: row.releasedAt,
    }));
  }

  async listCompletedCompliance(authority: CustomerPortalQueryAuthority) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await this.repository.listCompletedCompliance(authority);
    return rows.map((row) => ({
      id: `${row.workpackId}:${row.complianceItemId}`,
      aircraftRegistration: row.aircraftRegistration,
      itemType: row.itemType,
      referenceCode: row.referenceCode,
      title: row.title,
      status: 'COMPLETED',
      dueAt: null,
      completedAt: row.completedAt,
    }));
  }
}

export const customerPortalService = new CustomerPortalService();
