import type { CreateOptions, FindOptions, InferCreationAttributes } from 'sequelize';
import { UtilisationEvent } from '../../models/index.js';
import { AircraftUtilisationTenantRepository, type UtilisationEventModelPort, type UtilisationEventRecord } from './aircraft-utilisation-tenant.repository.js';
const port: UtilisationEventModelPort = {
  findOne: (options) => UtilisationEvent.findOne(options as FindOptions) as unknown as Promise<UtilisationEventRecord | null>,
  create: (values, options) => UtilisationEvent.create(values as unknown as InferCreationAttributes<UtilisationEvent>, options as CreateOptions) as unknown as Promise<UtilisationEventRecord>,
};
export const aircraftUtilisationTenantRepository = new AircraftUtilisationTenantRepository(port);
