import { Op, type WhereOptions } from 'sequelize';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from './tenant-query-authority.js';

export type TenantBusinessWhere = Readonly<WhereOptions>;
export type TenantScopedWhere = Readonly<WhereOptions>;

type RootKind =
  | 'AIRCRAFT'
  | 'CUSTOMER'
  | 'SERIALIZED_COMPONENT'
  | 'PLANNING_SESSION'
  | 'WORKPACK';

const ownershipColumns: Readonly<Record<RootKind, string>> = Object.freeze({
  AIRCRAFT: 'tenant_id',
  CUSTOMER: 'tenant_id',
  SERIALIZED_COMPONENT: 'custodian_tenant_id',
  PLANNING_SESSION: 'tenant_id',
  WORKPACK: 'tenant_id',
});

function scopedWhere(
  root: RootKind,
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  assertTenantQueryAuthority(authority);

  const ownership = Object.freeze({
    [ownershipColumns[root]]: authority.tenantId,
  });
  const conditions = Object.freeze([ownership, businessWhere]);
  return Object.freeze({ [Op.and]: conditions });
}

export function aircraftTenantWhere(
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  return scopedWhere('AIRCRAFT', authority, businessWhere);
}

export function customerTenantWhere(
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  return scopedWhere('CUSTOMER', authority, businessWhere);
}

export function serializedComponentTenantWhere(
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  return scopedWhere('SERIALIZED_COMPONENT', authority, businessWhere);
}

export function planningSessionTenantWhere(
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  return scopedWhere('PLANNING_SESSION', authority, businessWhere);
}

export function workpackTenantWhere(
  authority: TenantQueryAuthority,
  businessWhere: TenantBusinessWhere,
): TenantScopedWhere {
  return scopedWhere('WORKPACK', authority, businessWhere);
}
