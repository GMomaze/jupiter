import { describe, it, expect, afterAll } from 'vitest';
import { BaseReferenceService } from './BaseReferenceService';
import { pool } from '../../config/database.js';

describe('Reference Engine: Phase 1.7 Verification', () => {
  const service = new BaseReferenceService('rf_aircraft_category');

  // Close the DB pool after tests finish
  //afterAll(async () => {
   // await pool.end();
 // });

  // Rule: Valid Create
  it('should allow creating a valid user-level reference', async () => {
    const code = 'TEST_CAT_' + Date.now();
    const result = await service.create({ 
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
    await service.create(duplicateData);

    await expect(service.create(duplicateData))
      .rejects.toThrow(/already exists/);
  });

  // Rule: system_locked Protection
  it('should reject deactivation of system_locked rows', async () => {
    const lockedRow = await pool.query(
      `INSERT INTO rf_aircraft_category (code, label, system_locked) 
       VALUES ('LOCKED_SYS_${Date.now()}', 'Locked', true) RETURNING id`
    );
    const id = lockedRow.rows[0].id;

    await expect(service.deactivate(id))
      .rejects.toThrow(/system-locked/);
  });

  // Rule: Unauthorized Create Rejected
  it('should reject creation if ability lacks permission', async () => {
    const mockAbility = {
      cannot: (action: string, subject: string) => action === 'create' && subject === 'rf_aircraft_category'
    };

    const data = { code: 'AUTH_TEST', label: 'No Auth' };
    
    await expect(service.create(data, mockAbility))
      .rejects.toThrow(/UNAUTHORIZED/);
  });
});