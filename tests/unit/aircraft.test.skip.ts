import { describe, it, expect } from 'vitest';
import { AircraftService } from './aircraft.service.ts';

describe('Phase 4: Aircraft Engineering Constraints', () => {

  it('should enforce REGISTERED -> ACTIVE -> RETIRED sequence', async () => {
    // 1. Setup Registered
    const ac = await AircraftService.create({ registration: 'ZS-TST', ... });
    
    // 2. Valid Transition
    const active = await AircraftService.transitionStatus(ac.id, 'ACTIVE', 'Test');
    expect(active.status).toBe('ACTIVE');

    // 3. Invalid: Cannot go back to REGISTERED
    await expect(
      AircraftService.transitionStatus(ac.id, 'REGISTERED', 'Going Back')
    ).rejects.toThrow();
  });

  it('should audit transition reasons to the ledger', async () => {
    const ac = await AircraftService.create({ registration: 'ZS-AUD', ... });
    const reason = "Verification Test";
    
    await AircraftService.transitionStatus(ac.id, 'ACTIVE', reason);
    
    // Check Phase 3 Audit Service
    const { rows } = await pool.query('SELECT reason FROM audit_log WHERE row_id = $1', [ac.id]);
    expect(rows[0].reason).toBe(reason);
  });
});