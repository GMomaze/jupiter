import type { CreateOptions, FindOptions, InferCreationAttributes, UpdateOptions } from 'sequelize';
import { AircraftComponentInstallation } from '../../models/index.js';
import { AircraftComponentInstallationTenantRepository, type InstallationModelPort, type InstallationTenantRecord } from './aircraft-component-installation-tenant.repository.js';

const port: InstallationModelPort = {
  findOne: (options) => AircraftComponentInstallation.findOne(options as FindOptions) as unknown as Promise<InstallationTenantRecord | null>,
  findAll: (options) => AircraftComponentInstallation.findAll(options as FindOptions) as unknown as Promise<readonly InstallationTenantRecord[]>,
  create: (values, options) => AircraftComponentInstallation.create(values as unknown as InferCreationAttributes<AircraftComponentInstallation>, options as CreateOptions) as unknown as Promise<InstallationTenantRecord>,
  update: (values, options) => AircraftComponentInstallation.update(values, options as unknown as UpdateOptions),
};
export const aircraftComponentInstallationTenantRepository = new AircraftComponentInstallationTenantRepository(port);
