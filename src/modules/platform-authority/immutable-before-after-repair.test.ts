import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('L2-2C immutable before/after repair', () => {
  it('captures locked authoritative state for update and delete families', () => {
    const library = read('src/modules/library/library.service.ts');
    expect(library).toMatch(/updateModel[\s\S]*findByPk\(id, \{ transaction, lock: transaction\.LOCK\.UPDATE \}\)[\s\S]*audit\.setBefore/);
    expect(library).toMatch(/updateRequirement[\s\S]*findByPk\(id, \{ transaction, lock: transaction\.LOCK\.UPDATE \}\)[\s\S]*audit\.setBefore/);
    expect(library).toMatch(/deleteRequirement[\s\S]*findByPk\(id, \{ transaction, lock: transaction\.LOCK\.UPDATE \}\)[\s\S]*audit\.setBefore/);
    const reference = read('src/modules/reference/BaseReferenceService.ts');
    expect(reference).toMatch(/SELECT \* FROM \$\{this\.tableName\} WHERE id = \$1 FOR UPDATE[\s\S]*audit\.setBefore/);
  });

  it('captures authoritative allocation/relationship and life-limit state', () => {
    const allocation = read('src/modules/library/ad-applicability-allocation.service.ts');
    expect(allocation).toContain('lock: transaction.LOCK.UPDATE');
    expect(allocation.match(/audit\.setBefore\(/g)?.length).toBeGreaterThanOrEqual(5);
    const library = read('src/modules/library/library.service.ts');
    expect(library).toMatch(/linkSbModelAllocationToModels[\s\S]*relationshipsBefore[\s\S]*ORDER BY model_id ASC[\s\S]*FOR UPDATE[\s\S]*audit\.setBefore\(\{ allocation, relationships: relationshipsBefore \}\)/);
    const lifeLimit = read('src/modules/library/component-life-limit-governance.service.ts');
    expect(lifeLimit).toMatch(/proposeRevision[\s\S]*proposalForUpdate[\s\S]*audit\.setBefore/);
    expect(lifeLimit).toMatch(/approve[\s\S]*proposalForUpdate[\s\S]*audit\.setBefore/);
    expect(lifeLimit).toMatch(/activate[\s\S]*FOR UPDATE OF pub,proposal[\s\S]*audit\.setBefore/);
  });

  it('captures deterministic authoritative SB-allocation relationship and model snapshots', () => {
    const library = read('src/modules/library/library.service.ts');
    const link = library.slice(
      library.indexOf('static async linkSbModelAllocationToModels'),
      library.indexOf('static async recheckExactSbModelAllocations'),
    );
    expect(link).toContain('lock: transaction.LOCK.UPDATE');
    expect(link).toContain('audit.setBefore({ allocation, relationships: relationshipsBefore })');
    expect(link).toContain('auditAfter = { allocation: allocationsAfter[0], relationships: relationshipsAfter }');
    expect(link).toContain('ORDER BY model_id ASC');
    expect(link).not.toContain('after: result');

    const create = library.slice(
      library.indexOf('static async createIncompleteModelFromSbAllocation'),
      library.indexOf('\n  static async', library.indexOf('static async createIncompleteModelFromSbAllocation') + 1),
    );
    expect(create).toMatch(/LIMIT 1\s+FOR UPDATE/);
    expect(create).toContain('componentModel: existingModels[0] || null');
    expect(create).toContain('relationships: relationshipsBefore');
    expect(create).toContain('componentModel: modelsAfter[0]');
    expect(create).toContain('relationships: relationshipsAfter');
    expect(create).not.toContain('after: result');
  });

  it('leaves every approved L2-2D deferral without the L2-2C audit capture', () => {
    const inventory = read('src/modules/platform-authority/l2-2c-writer-inventory.test.ts');
    expect(inventory).toContain('projectAdAndSbSources');
    expect(inventory).toContain('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED');
    expect(inventory).toContain('syncAll');
    expect(inventory).toContain('createManufacturer');
  });
});
