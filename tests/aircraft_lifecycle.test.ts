import { describe, it, expect } from 'vitest';
import { AircraftService } from '../src/modules/aircraft/aircraft.service.js';
import { createAircraft } from './helpers/domain.factory.js';
import { pool } from '../src/config/database.js';

describe('Phase 4: Aircraft Lifecycle & Engineering Constraints', () => {

  it('Requirement: Create aircraft in REGISTERED state', async () => {
    const seeded = await createAircraft();
    const aircraft = await AircraftService.getById(seeded.aircraftId);

    expect(aircraft).toBeDefined();
    expect(aircraft?.status).toBe('REGISTERED');
  });

  it('Requirement: Valid Transition (REGISTERED -> ACTIVE)', async () => {
    const seeded = await createAircraft();
    const activated = await AircraftService.activate(
      seeded.aircraftId,
      'Test activation'
    );
    expect(activated.status).toBe('ACTIVE');
  });

  it('Requirement: Invalid Transition Rejected (REGISTERED skip to RETIRED)', async () => {
    const seeded = await createAircraft();
    await expect(
      AircraftService.retire(seeded.aircraftId, 'Illegal jump')
    ).rejects.toThrow(/INVALID_TRANSITION/);
  });

  it('Requirement: Transitions are audited with reasons', async () => {
    const seeded = await createAircraft();
    const reason = 'Engineering Release Note 123';
    await AircraftService.activate(seeded.aircraftId, reason);

    const { rows } = await pool.query(
      `SELECT reason FROM audit_log WHERE row_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [seeded.aircraftId]
    );
    expect(rows[0].reason).toBe(reason);
  });
});