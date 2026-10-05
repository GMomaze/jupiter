import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('L2-2C writer inventory', () => {
  it('records D4 automated writers as fail-closed after D2/D3 conversion', () => {
    const library = read('src/modules/library/library.service.ts');
    expect(library).toMatch(/static async createManufacturer\(evidence: PlatformMutationEvidence/);
    expect(library).toMatch(/static async updateManufacturer\(\s*evidence: PlatformMutationEvidence/);
    const sync = read('src/modules/service-bulletins/service-bulletin-sync.service.ts');
    expect(sync).toMatch(/static async syncAll\(\s*evidence: PlatformMutationEvidence/);
    expect(read('src/modules/maintenance/maintenance-trigger.service.ts')).toContain('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED');
    const projection = read('src/modules/compliance/compliance-projection.service.ts');
    for (const method of ['projectAdSources', 'projectSbSources', 'projectAdAndSbSources']) {
      expect(projection).toContain(`static async ${method}(`);
    }
    expect(projection.match(/DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED/g)).toHaveLength(3);
  });

  it('requires evidence on every included public writer family', () => {
    const library = read('src/modules/library/library.service.ts');
    for (const method of [
      'createAssetType', 'refreshAdApplicabilityReviewAllocations', 'refreshAdServiceBulletinReferences',
      'reviewAdApplicabilityAllocation', 'restoreAdApplicabilityAllocation',
      'linkAdApplicabilityAllocationToModel', 'linkAdApplicabilityAllocationToManufacturer',
      'createAirworthinessDirective', 'createLibraryServiceBulletin',
      'createSupplementalInspectionDocument', 'linkSbModelAllocationToModels',
      'recheckExactSbModelAllocations', 'expandSafeSbShorthandAllocations',
      'ignoreSbModelAllocation', 'createIncompleteModelFromSbAllocation', 'createModel',
      'updateModel', 'createRequirement', 'updateRequirement', 'deleteRequirement',
      'createServiceBulletin', 'createServiceBulletinsBulk', 'attachServiceBulletinsToModel',
      'assignAirworthinessDirectiveToModel', 'assignAirworthinessDirectiveToModelByNumber',
      'assignSupplementalInspectionDocumentToModel', 'assignStandardTaskToModel', 'importModelSidsFromCsv',
      'createManufacturer', 'updateManufacturer',
    ]) expect(library).toMatch(new RegExp(`static async ${method}\\([\\s\\S]{0,80}evidence: PlatformMutationEvidence`));
  });
});
