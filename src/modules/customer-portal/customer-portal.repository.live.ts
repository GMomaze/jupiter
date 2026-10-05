import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { assertCustomerPortalQueryAuthority } from './customer-portal-query-authority.js';
import {
  CUSTOMER_PORTAL_VISIBLE_RELATIONSHIP_TYPES,
  type CustomerPortalAircraftRow,
  type CustomerPortalComplianceRow,
  type CustomerPortalDocumentRow,
  type CustomerPortalIdentity,
  type CustomerPortalRepository,
  type CustomerPortalWorkpackRow,
} from './customer-portal.repository.js';

type RawIdentity = {
  customer_user_id: string;
  customer_id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  customer_name: string;
};

const IDENTITY_JOIN = `
  FROM customer_users cu
  JOIN customers c ON c.id = cu.customer_id
  JOIN tenants t ON t.id = c.tenant_id
`;

function identity(row: RawIdentity): CustomerPortalIdentity {
  return Object.freeze({
    customerUserId: row.customer_user_id,
    customerId: row.customer_id,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    customerName: row.customer_name,
  });
}

function replacements(authority: { customerId: string; tenantId: string }) {
  return {
    customerId: authority.customerId,
    tenantId: authority.tenantId,
    relationshipTypes: [...CUSTOMER_PORTAL_VISIBLE_RELATIONSHIP_TYPES],
  };
}

export class SequelizeCustomerPortalRepository implements CustomerPortalRepository {
  async resolveIdentity(customerUserId: string) {
    if (!customerUserId) return undefined;
    const rows = await sequelize.query<RawIdentity>(`
      SELECT cu.id AS customer_user_id, c.id AS customer_id, c.tenant_id,
             cu.email, cu.display_name, c.name AS customer_name
      ${IDENTITY_JOIN}
      WHERE cu.id = :customerUserId
        AND cu.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
        AND t.status = 'ACTIVE'
      LIMIT 2
    `, { replacements: { customerUserId }, type: QueryTypes.SELECT });
    return rows.length === 1 ? identity(rows[0]!) : undefined;
  }

  async getIdentity(authority: Parameters<CustomerPortalRepository['getIdentity']>[0]) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await sequelize.query<RawIdentity>(`
      SELECT cu.id AS customer_user_id, c.id AS customer_id, c.tenant_id,
             cu.email, cu.display_name, c.name AS customer_name
      ${IDENTITY_JOIN}
      WHERE cu.id = :customerUserId
        AND c.id = :customerId
        AND c.tenant_id = :tenantId
        AND cu.status = 'ACTIVE'
        AND c.status = 'ACTIVE'
        AND t.status = 'ACTIVE'
      LIMIT 2
    `, {
      replacements: {
        customerUserId: authority.customerUserId,
        customerId: authority.customerId,
        tenantId: authority.tenantId,
      },
      type: QueryTypes.SELECT,
    });
    return rows.length === 1 ? identity(rows[0]!) : undefined;
  }

  async listAircraft(authority: Parameters<CustomerPortalRepository['listAircraft']>[0]) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await sequelize.query<{
      id: string; registration: string; serial_number: string | null;
      model_name: string | null; manufacturer_name: string | null; relationship_type: string;
    }>(`
      SELECT a.id, a.registration, a.serial_number, cm.model_name,
             m.name AS manufacturer_name, cal.relationship_type
      FROM customers c
      JOIN customer_aircraft_links cal ON cal.customer_id = c.id
      JOIN aircraft a ON a.id = cal.aircraft_id
      LEFT JOIN component_models cm ON cm.id = a.model_id
      LEFT JOIN manufacturers m ON m.id = cm.manufacturer_id
      WHERE c.id = :customerId AND c.tenant_id = :tenantId AND c.status = 'ACTIVE'
        AND a.tenant_id = :tenantId
        AND cal.is_current = true
        AND cal.relationship_type IN (:relationshipTypes)
      ORDER BY a.registration ASC, cal.relationship_type ASC
    `, { replacements: replacements(authority), type: QueryTypes.SELECT });
    return rows.map((row): CustomerPortalAircraftRow => Object.freeze({
      id: row.id,
      registration: row.registration,
      serialNumber: row.serial_number,
      modelName: row.model_name,
      manufacturerName: row.manufacturer_name,
      relationshipType: row.relationship_type,
    }));
  }

  async listWorkpacks(authority: Parameters<CustomerPortalRepository['listWorkpacks']>[0]) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await sequelize.query<{
      id: string; work_order_number: string; created_at: Date | string | null;
      certified_at: Date | string | null; qa_reviewed_at: Date | string | null;
      released_at: Date | string | null; aircraft_registration: string;
      status_code: string | null; status_label: string | null; relationship_type: string;
    }>(`
      SELECT DISTINCT w.id, w.work_order_number, w.created_at, w.certified_at,
             w.qa_reviewed_at, w.released_at, a.registration AS aircraft_registration,
             s.code AS status_code, s.label AS status_label, cal.relationship_type
      FROM customers c
      JOIN customer_aircraft_links cal ON cal.customer_id = c.id
      JOIN aircraft a ON a.id = cal.aircraft_id
      JOIN workpacks w ON w.aircraft_id = a.id
      JOIN rf_workpack_status s ON s.id = w.status_id
      WHERE c.id = :customerId AND c.tenant_id = :tenantId AND c.status = 'ACTIVE'
        AND a.tenant_id = :tenantId AND w.tenant_id = :tenantId
        AND cal.is_current = true
        AND cal.relationship_type IN (:relationshipTypes)
      ORDER BY w.created_at DESC, w.work_order_number DESC
    `, { replacements: replacements(authority), type: QueryTypes.SELECT });
    return rows.map((row): CustomerPortalWorkpackRow => Object.freeze({
      id: row.id, workOrderNumber: row.work_order_number, createdAt: row.created_at,
      certifiedAt: row.certified_at, qaReviewedAt: row.qa_reviewed_at,
      releasedAt: row.released_at, aircraftRegistration: row.aircraft_registration,
      statusCode: row.status_code, statusLabel: row.status_label,
      relationshipType: row.relationship_type,
    }));
  }

  async listReleasedDocuments(authority: Parameters<CustomerPortalRepository['listReleasedDocuments']>[0]) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await sequelize.query<{
      workpack_id: string; work_order_number: string; created_at: Date | string | null;
      released_at: Date | string; aircraft_registration: string;
    }>(`
      SELECT DISTINCT w.id AS workpack_id, w.work_order_number, w.created_at,
             w.released_at, a.registration AS aircraft_registration
      FROM customers c
      JOIN customer_aircraft_links cal ON cal.customer_id = c.id
      JOIN aircraft a ON a.id = cal.aircraft_id
      JOIN workpacks w ON w.aircraft_id = a.id
      WHERE c.id = :customerId AND c.tenant_id = :tenantId AND c.status = 'ACTIVE'
        AND a.tenant_id = :tenantId AND w.tenant_id = :tenantId
        AND cal.is_current = true
        AND cal.relationship_type IN (:relationshipTypes)
        AND w.released_at IS NOT NULL
      ORDER BY w.released_at DESC, w.work_order_number DESC
    `, { replacements: replacements(authority), type: QueryTypes.SELECT });
    return rows.map((row): CustomerPortalDocumentRow => Object.freeze({
      workpackId: row.workpack_id, workOrderNumber: row.work_order_number,
      createdAt: row.created_at, releasedAt: row.released_at,
      aircraftRegistration: row.aircraft_registration,
    }));
  }

  async listCompletedCompliance(authority: Parameters<CustomerPortalRepository['listCompletedCompliance']>[0]) {
    assertCustomerPortalQueryAuthority(authority);
    const rows = await sequelize.query<{
      workpack_id: string; compliance_item_id: string; aircraft_registration: string;
      item_type: 'AD' | 'SB'; reference_code: string; title: string;
      completed_at: Date | string | null;
    }>(`
      SELECT DISTINCT w.id AS workpack_id, wc.compliance_item_id,
             a.registration AS aircraft_registration, ci.item_type,
             ci.code AS reference_code, ci.title, wc.completed_at
      FROM customers c
      JOIN customer_aircraft_links cal ON cal.customer_id = c.id
      JOIN aircraft a ON a.id = cal.aircraft_id
      JOIN workpacks w ON w.aircraft_id = a.id
      JOIN workpack_compliance wc ON wc.workpack_id = w.id
      JOIN compliance_items ci ON ci.id = wc.compliance_item_id
      WHERE c.id = :customerId AND c.tenant_id = :tenantId AND c.status = 'ACTIVE'
        AND a.tenant_id = :tenantId AND w.tenant_id = :tenantId
        AND cal.is_current = true
        AND cal.relationship_type IN (:relationshipTypes)
        AND wc.status = 'COMPLETED'
      ORDER BY a.registration ASC, ci.item_type ASC, ci.code ASC
    `, { replacements: replacements(authority), type: QueryTypes.SELECT });
    return rows.map((row): CustomerPortalComplianceRow => Object.freeze({
      workpackId: row.workpack_id, complianceItemId: row.compliance_item_id,
      aircraftRegistration: row.aircraft_registration, itemType: row.item_type,
      referenceCode: row.reference_code, title: row.title, completedAt: row.completed_at,
    }));
  }
}

export const customerPortalRepository = new SequelizeCustomerPortalRepository();
