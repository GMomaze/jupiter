import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

export interface LegacyReconciliationRow {
  legacy_component_id: string;
  aircraft_id: string;
  aircraft_registration: string;
  legacy_model_id: string;
  legacy_serial_number: string;
  legacy_position: string | null;
  legacy_status: string;
  legacy_removed_at: Date | null;
  legacy_model_code: string | null;
  legacy_model_name: string | null;
  legacy_asset_type_id: string | null;
  legacy_asset_type_code: string | null;
}

export interface SerializedInstallationReconciliationRow {
  serialized_installation_id: string;
  aircraft_id: string;
  aircraft_registration: string;
  serialized_position: string | null;
  serialized_removed_at: Date | null;
  serialized_component_id: string;
  serialized_model_id: string;
  serialized_serial_number: string;
  serialized_status: string;
  serialized_model_code: string | null;
  serialized_model_name: string | null;
  serialized_asset_type_id: string | null;
  serialized_asset_type_code: string | null;
  life_state_id: string | null;
}

export interface SerializedComponentReconciliationData {
  legacyRows: LegacyReconciliationRow[];
  serializedInstallationRows: SerializedInstallationReconciliationRow[];
  totalSerializedComponents: number;
}

export interface SerializedComponentReconciliationRepositoryPort {
  loadForTenant(tenantId: string): Promise<SerializedComponentReconciliationData>;
}

export class SerializedComponentReconciliationRepository {
  constructor(private readonly port: SerializedComponentReconciliationRepositoryPort) {}

  load(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    return this.port.loadForTenant(authority.tenantId);
  }
}
