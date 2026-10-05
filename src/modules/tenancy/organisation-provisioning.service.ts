import type {
  ProvisionOrganisationInput,
  ProvisionOrganisationResult,
} from './organisation-provisioning.contracts.js';
import { OrganisationProvisioningRepository } from './organisation-provisioning.repository.js';

export class OrganisationProvisioningService {
  constructor(private readonly repository: OrganisationProvisioningRepository) {}

  provision(input: ProvisionOrganisationInput): Promise<ProvisionOrganisationResult> {
    return this.repository.provision(input);
  }
}
