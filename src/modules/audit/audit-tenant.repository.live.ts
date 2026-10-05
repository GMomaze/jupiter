import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import {
  AuditTenantRepository,
  type TenantAuditLogProjection,
} from './audit-tenant.repository.js';

const AUTHORIZED_AUDIT_SQL = `
  SELECT
    audit.id,
    audit.table_name,
    audit.row_id,
    audit.action,
    audit.old_values,
    audit.new_values,
    audit.reason,
    audit.created_at,
    actor.email AS actor_name
  FROM audit_log audit
  LEFT JOIN users actor ON actor.id = audit.actor_id
  WHERE (:tableName::text IS NULL OR audit.table_name = :tableName)
    AND CASE audit.table_name
      WHEN 'aircraft' THEN EXISTS (
        SELECT 1 FROM aircraft owned_aircraft
        WHERE owned_aircraft.id = audit.row_id
          AND owned_aircraft.tenant_id = :tenantId
      )
      WHEN 'customers' THEN EXISTS (
        SELECT 1 FROM customers owned_customer
        WHERE owned_customer.id = audit.row_id
          AND owned_customer.tenant_id = :tenantId
      )
      WHEN 'workpacks' THEN EXISTS (
        SELECT 1 FROM workpacks owned_workpack
        WHERE owned_workpack.id = audit.row_id
          AND owned_workpack.tenant_id = :tenantId
      )
      WHEN 'task_cards' THEN
        EXISTS (
          SELECT 1
          FROM workpack_tasks current_link
          JOIN workpacks current_workpack ON current_workpack.id = current_link.workpack_id
          WHERE current_link.task_id = audit.row_id
            AND current_workpack.tenant_id = :tenantId
        )
        AND NOT EXISTS (
          SELECT 1
          FROM workpack_tasks foreign_link
          JOIN workpacks foreign_workpack ON foreign_workpack.id = foreign_link.workpack_id
          WHERE foreign_link.task_id = audit.row_id
            AND foreign_workpack.tenant_id <> :tenantId
        )
      WHEN 'workpack_snags' THEN EXISTS (
        SELECT 1
        FROM workpack_snags snag
        WHERE snag.id = audit.row_id
          AND (
            (
              snag.workpack_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM workpacks owned_workpack
                WHERE owned_workpack.id = snag.workpack_id
                  AND owned_workpack.tenant_id = :tenantId
              )
              AND EXISTS (
                SELECT 1 FROM aircraft owned_aircraft
                WHERE owned_aircraft.id = snag.aircraft_id
                  AND owned_aircraft.tenant_id = :tenantId
              )
            )
            OR
            (
              snag.workpack_id IS NULL
              AND EXISTS (
                SELECT 1 FROM aircraft owned_aircraft
                WHERE owned_aircraft.id = snag.aircraft_id
                  AND owned_aircraft.tenant_id = :tenantId
              )
            )
          )
      )
      WHEN 'aircraft_compliance' THEN EXISTS (
        SELECT 1
        FROM aircraft_compliance compliance
        JOIN aircraft owned_aircraft ON owned_aircraft.id = compliance.aircraft_id
        WHERE compliance.id = audit.row_id
          AND owned_aircraft.tenant_id = :tenantId
      )
      WHEN 'utilisation_events' THEN EXISTS (
        SELECT 1
        FROM utilisation_events event
        JOIN aircraft owned_aircraft ON owned_aircraft.id = event.aircraft_id
        WHERE event.id = audit.row_id
          AND owned_aircraft.tenant_id = :tenantId
      )
      WHEN 'customer_aircraft_links' THEN EXISTS (
        SELECT 1
        FROM customer_aircraft_links link
        JOIN customers owned_customer ON owned_customer.id = link.customer_id
        JOIN aircraft owned_aircraft ON owned_aircraft.id = link.aircraft_id
        WHERE link.id = audit.row_id
          AND owned_customer.tenant_id = :tenantId
          AND owned_aircraft.tenant_id = :tenantId
      )
      ELSE FALSE
    END
  ORDER BY audit.created_at DESC
  LIMIT 100`;

export const auditTenantRepository = new AuditTenantRepository({
  listAuthorized: (tenantId, filters) => sequelize.query<TenantAuditLogProjection>(
    AUTHORIZED_AUDIT_SQL,
    {
      replacements: {
        tenantId,
        tableName: filters.tableName ?? null,
      },
      type: QueryTypes.SELECT,
    },
  ),
});
