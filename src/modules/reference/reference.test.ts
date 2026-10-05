import { describe, it, expect, afterAll, vi } from 'vitest';
vi.mock('../platform-authority/authoritative-platform-mutation.js', () => ({
  requirePlatformMutationOperations: (evidence: unknown) => evidence,
  executeAuthoritativePgPlatformMutation: async (pool: any, _evidence: unknown, work: (client: any, audit: any) => Promise<unknown>) => work(pool, { setBefore: vi.fn() }),
}));
import { BaseReferenceService } from './BaseReferenceService';
import { pool } from '../../config/database.js';

describe('Reference Engine: Phase 1.7 Verification', () => {
  const service = new BaseReferenceService('rf_aircraft_category');
  const evidence = {} as any;

  // Close the DB pool after tests finish
  afterAll(async () => {
    await pool.query(`DELETE FROM rf_aircraft_category WHERE code LIKE 'TEST_CAT_%' OR code LIKE 'DUP_%' OR code LIKE 'LOCKED_SYS_%' OR code='AUTH_TEST'`);
  });

  // Rule: Valid Create
  it('should allow creating a valid user-level reference', async () => {
    const code = 'TEST_CAT_' + Date.now();
    const result = await service.create(evidence, {
      code, 
      label: 'Test Category', 
      description: 'Test Desc' 
    });
    
    expect(result.code).toBe(code);
    expect(result.system_locked).toBe(false); 
  });

  // Rule: Duplicate Rejection
  it('should reject duplicate codes', async () => {
    const code = 'DUP_' + Date.now();
    const duplicateData = { code, label: 'First' };
    await service.create(evidence, duplicateData);

    await expect(service.create(evidence, duplicateData))
      .rejects.toThrow(/already exists|duplicate key/);
  });

  // Rule: system_locked Protection
  it('should reject deactivation of system_locked rows', async () => {
    const lockedRow = await pool.query(
      `INSERT INTO rf_aircraft_category (code, label, system_locked) 
       VALUES ('LOCKED_SYS_${Date.now()}', 'Locked', true) RETURNING id`
    );
    const id = lockedRow.rows[0].id;

    await expect(service.deactivate(evidence, id))
      .rejects.toThrow(/system-locked/);
  });

  // Rule: Unauthorized Create Rejected
  it('should reject creation if ability lacks permission', async () => {
    const mockAbility = {
      cannot: (action: string, subject: string) => action === 'create' && subject === 'rf_aircraft_category'
    };

    const data = { code: 'AUTH_TEST', label: 'No Auth' };
    
    await expect(service.create(evidence, data, mockAbility as any))
      .rejects.toThrow(/UNAUTHORIZED/);
  });
});
