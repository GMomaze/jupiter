import {
  type CreateOptions,
  type FindOptions,
  type InferCreationAttributes,
  type UpdateOptions,
} from 'sequelize';
import { Aircraft } from '../../models/index.js';
import {
  AircraftTenantRepository,
  type AircraftModelPort,
} from './aircraft-tenant.repository.js';

const liveAircraftModelPort: AircraftModelPort = {
  findOne: (options: Readonly<Record<string, unknown>>) =>
    Aircraft.findOne(options as FindOptions),
  findAll: (options: Readonly<Record<string, unknown>>) =>
    Aircraft.findAll(options as FindOptions),
  count: (options: Readonly<Record<string, unknown>>) =>
    Aircraft.count(options as FindOptions),
  create: (values, options) =>
    Aircraft.create(
      values as unknown as InferCreationAttributes<Aircraft>,
      options as CreateOptions,
    ),
  update: (values, options) =>
    Aircraft.update(values, options as unknown as UpdateOptions),
};

export const aircraftTenantRepository = new AircraftTenantRepository(liveAircraftModelPort);
