import type { CreateOptions, FindOptions, InferCreationAttributes } from 'sequelize';
import { AircraftComponentMovementHistory } from '../../models/index.js';
import {
  AircraftComponentMovementHistoryRepository,
  type AircraftComponentMovementHistoryModelPort,
} from './aircraft-component-movement-history.repository.js';

const port: AircraftComponentMovementHistoryModelPort = {
  create: (values, options) => AircraftComponentMovementHistory.create(
    values as unknown as InferCreationAttributes<AircraftComponentMovementHistory>,
    options as CreateOptions,
  ),
  findAll: (options) => AircraftComponentMovementHistory.findAll(options as FindOptions),
};

export const aircraftComponentMovementHistoryRepository =
  new AircraftComponentMovementHistoryRepository(port);
