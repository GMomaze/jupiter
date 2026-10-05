import { serializedComponentReconciliationRepository } from './serialized-component-reconciliation.repository.live.js';
import { SerializedComponentReconciliationService } from './serialized-component-reconciliation.service.js';

export const serializedComponentReconciliationService =
  new SerializedComponentReconciliationService(serializedComponentReconciliationRepository);
