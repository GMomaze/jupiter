import { fleetProjectionRepository } from './projection.repository.live.js';
import { FleetProjectionService } from './projection.service.js';

export const fleetProjectionService = new FleetProjectionService(fleetProjectionRepository);
