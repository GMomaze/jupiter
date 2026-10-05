import type { Transaction } from 'sequelize';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

export interface AircraftComponentMovementHistoryCreateInput {
  readonly aircraft_component_id: string;
  readonly action_type: 'INSTALLATION' | 'REMOVAL';
  readonly source_aircraft_id: string | null;
  readonly target_aircraft_id: string | null;
  readonly actor_id: string;
  readonly occurred_at: Date;
  readonly aircraft_hours: number;
  readonly remarks: string | null;
}

export interface AircraftComponentMovementHistoryModelPort {
  create(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<{ transaction: Transaction }>,
  ): Promise<unknown>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly unknown[]>;
}

export class AircraftComponentMovementHistoryRepository {
  constructor(private readonly model: AircraftComponentMovementHistoryModelPort) {}

  async append(
    authority: TenantQueryAuthority,
    input: AircraftComponentMovementHistoryCreateInput,
    options: Readonly<{ transaction: Transaction }>,
  ) {
    assertTenantQueryAuthority(authority);
    try {
      return await this.model.create(
        { ...input, tenant_id: authority.tenantId },
        options,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') throw error;
      throw new Error('MOVEMENT_HISTORY_APPEND_FAILED');
    }
  }

  async listForComponent(authority: TenantQueryAuthority, aircraftComponentId: string) {
    assertTenantQueryAuthority(authority);
    try {
      return await this.model.findAll({
        where: Object.freeze({
          tenant_id: authority.tenantId,
          aircraft_component_id: aircraftComponentId,
        }),
        order: Object.freeze([Object.freeze(['occurred_at', 'ASC'])]),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') throw error;
      throw new Error('TENANT_QUERY_FAILED');
    }
  }
}
