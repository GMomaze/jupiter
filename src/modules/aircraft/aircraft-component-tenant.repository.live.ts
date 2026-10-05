import type { CreateOptions, FindOptions } from 'sequelize';
import { AircraftComponent } from '../../models/index.js';
import { AircraftComponentTenantRepository, type AircraftComponentModelPort, type AircraftComponentTenantRecord } from './aircraft-component-tenant.repository.js';

const port: AircraftComponentModelPort = {
  findOne: (options) => AircraftComponent.findOne(options as FindOptions) as unknown as Promise<AircraftComponentTenantRecord | null>,
  findAll: (options) => AircraftComponent.findAll(options as FindOptions) as unknown as Promise<readonly AircraftComponentTenantRecord[]>,
  create: (values, options) => AircraftComponent.create(values, options as CreateOptions) as unknown as Promise<AircraftComponentTenantRecord>,
  update: (values, options) => AircraftComponent.update(values, options) as unknown as Promise<readonly [number]>,
};
export const aircraftComponentTenantRepository = new AircraftComponentTenantRepository(port);
