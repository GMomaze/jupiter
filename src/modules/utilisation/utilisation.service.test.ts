import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AssetType,
  ComponentModel,
  Manufacturer,
  UtilisationEvent,
} from '../../models/index.js';
import { AircraftController } from '../aircraft/aircraft.controller.js';
import { AircraftService } from '../aircraft/aircraft.service.js';
import { UtilisationService } from './utilisation.service.js';

let aircraftSequence = 0;

async function createTestAircraft() {
  let aircraft;
  let category;
  let model;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    aircraftSequence += 1;
    const suffix = `${Date.now().toString(36)}_${aircraftSequence}_${randomUUID().replace(/-/g, '').slice(0, 10)}`.toUpperCase();
    const registrationSuffix = [
      String.fromCharCode(65 + Math.floor((aircraftSequence + attempt) / (26 * 26)) % 26),
      String.fromCharCode(65 + Math.floor((aircraftSequence + attempt) / 26) % 26),
      String.fromCharCode(65 + (aircraftSequence + attempt) % 26),
    ].join('');
    const manufacturer = await Manufacturer.create({
      code: `MFR_${suffix}`,
      name: `Manufacturer ${suffix}`,
      is_active: true,
    });
    const assetType = await AssetType.create({
      code: `AIRFRAME_${suffix}`,
      label: `Airframe ${suffix}`,
      is_installable_on_aircraft: false,
      is_required_for_aircraft: false,
      required_quantity: 0,
      is_active: true,
      system_locked: false,
    });
    category = await AircraftCategory.create({
      code: `CAT_${suffix}`,
      label: `Category ${suffix}`,
      is_active: true,
      system_locked: false,
    });
    model = await ComponentModel.create({
      model_name: `Model ${suffix}`,
      model_code: `MODEL_${suffix}`,
      manufacturer_id: manufacturer.id,
      asset_type_id: assetType.id,
      is_active: true,
    });
    try {
      aircraft = await Aircraft.create({
        registration: `ZS-${registrationSuffix}`,
        serial_number: `SN-${suffix}`,
        model_id: model.id,
        category_id: category.id,
        status: 'REGISTERED',
        total_time_hours: 0,
        total_time_cycles: 0,
        version: 0,
      });
      break;
    } catch (error: any) {
      if (error?.name !== 'SequelizeUniqueConstraintError') {
        throw error;
      }
    }
  }

  if (!aircraft || !category || !model) {
    throw new Error('UNABLE_TO_CREATE_UNIQUE_TEST_AIRCRAFT');
  }

  return { aircraft, category, model };
}

describe('UtilisationService', () => {
  it('creates an event for an hour increase and updates the aircraft snapshot', async () => {
    const { aircraft } = await createTestAircraft();

    const result = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 12.5,
      newTotalTimeCycles: 0,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Flight log update',
    });

    expect(Number(result.event.delta_hours)).toBe(12.5);
    expect(Number(result.aircraft.total_time_hours)).toBe(12.5);

    const storedEvent = await UtilisationEvent.findByPk(result.event.id);
    expect(storedEvent?.aircraft_id).toBe(aircraft.id);
    expect(Number(storedEvent?.new_total_time_hours)).toBe(12.5);
  });

  it('creates an event for a cycle increase and updates the aircraft snapshot', async () => {
    const { aircraft } = await createTestAircraft();

    const result = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 0,
      newTotalTimeCycles: 3,
      sourceType: 'JOURNEY_LOG',
      effectiveDate: '2026-06-17',
      reason: 'Journey log cycle update',
    });

    expect(result.event.delta_cycles).toBe(3);
    expect(result.aircraft.total_time_cycles).toBe(3);
  });

  it('creates one event for a combined hour and cycle increase', async () => {
    const { aircraft } = await createTestAircraft();

    const result = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 7.25,
      newTotalTimeCycles: 2,
      sourceType: 'FLIGHT_FOLIO',
      effectiveDate: '2026-06-17',
      reason: 'Flight folio combined update',
    });

    expect(Number(result.event.delta_hours)).toBe(7.25);
    expect(result.event.delta_cycles).toBe(2);
    expect(Number(result.aircraft.total_time_hours)).toBe(7.25);
    expect(result.aircraft.total_time_cycles).toBe(2);
  });

  it('records utilisation through the aircraft controller update action', async () => {
    const { aircraft } = await createTestAircraft();
    const flashMessages: Record<string, string[]> = {};
    let redirectPath = '';

    await AircraftController.updateUtilisation(
      {
        params: { id: aircraft.id },
        body: {
          total_time_hours: '0',
          total_time_cycles: '4',
          source_type: 'JOURNEY_LOG',
          effective_date: '2026-06-17',
          reason: 'Controller cycle-only update',
        },
        user: null,
        flash(type: string, message: string) {
          flashMessages[type] = [...(flashMessages[type] || []), message];
        },
      } as any,
      {
        redirect(path: string) {
          redirectPath = path;
        },
      } as any
    );

    const updated = await Aircraft.findByPk(aircraft.id);
    const storedEvent = await UtilisationEvent.findOne({
      where: { aircraft_id: aircraft.id },
      order: [['created_at', 'DESC']],
    });
    const utilisationSummary = JSON.parse(flashMessages.utilisationSummary?.[0] || '{}');

    expect(redirectPath).toBe(`/aircraft/view/${aircraft.id}`);
    expect(utilisationSummary).toEqual(
      expect.objectContaining({
        event_id: storedEvent?.id,
        previous_total_time_hours: expect.anything(),
        new_total_time_hours: expect.anything(),
        delta_hours: expect.anything(),
        previous_total_time_cycles: expect.anything(),
        new_total_time_cycles: expect.anything(),
        delta_cycles: expect.anything(),
        source_type: 'JOURNEY_LOG',
        reason: 'Controller cycle-only update',
      })
    );
    expect(updated?.total_time_cycles).toBe(4);
    expect(storedEvent?.delta_cycles).toBe(4);
  });

  it('records a decrease as a correction event when source reference is supplied', async () => {
    const { aircraft } = await createTestAircraft();
    const increase = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 20,
      newTotalTimeCycles: 4,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Initial log entry',
    });

    const correction = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 18,
      newTotalTimeCycles: 3,
      sourceType: 'MANUAL_ENTRY',
      sourceReference: 'Correction note 1',
      effectiveDate: '2026-06-17',
      reason: 'Corrected duplicated entry',
      correctionOfEventId: increase.event.id,
    });

    expect(correction.event.source_type).toBe('CORRECTION');
    expect(correction.event.correction_of_event_id).toBe(increase.event.id);
    expect(Number(correction.event.delta_hours)).toBe(-2);
    expect(correction.event.delta_cycles).toBe(-1);
  });

  it('blocks negative aircraft hours and cycles', async () => {
    const { aircraft } = await createTestAircraft();

    await expect(
      UtilisationService.recordUtilisation({
        aircraftId: aircraft.id,
        newTotalTimeHours: -1,
        sourceType: 'MANUAL_ENTRY',
        effectiveDate: '2026-06-17',
        reason: 'Invalid hours',
      })
    ).rejects.toThrow(/INVALID_TOTAL_TIME_HOURS/);

    await expect(
      UtilisationService.recordUtilisation({
        aircraftId: aircraft.id,
        newTotalTimeHours: 0,
        newTotalTimeCycles: -1,
        sourceType: 'MANUAL_ENTRY',
        effectiveDate: '2026-06-17',
        reason: 'Invalid cycles',
      })
    ).rejects.toThrow(/INVALID_TOTAL_TIME_CYCLES/);
  });

  it('blocks fractional cycles and zero-change events', async () => {
    const { aircraft } = await createTestAircraft();

    await expect(
      UtilisationService.recordUtilisation({
        aircraftId: aircraft.id,
        newTotalTimeHours: 0,
        newTotalTimeCycles: 1.5,
        sourceType: 'MANUAL_ENTRY',
        effectiveDate: '2026-06-17',
        reason: 'Invalid fractional cycles',
      })
    ).rejects.toThrow(/INVALID_TOTAL_TIME_CYCLES/);

    await expect(
      UtilisationService.recordUtilisation({
        aircraftId: aircraft.id,
        newTotalTimeHours: 0,
        newTotalTimeCycles: 0,
        sourceType: 'MANUAL_ENTRY',
        effectiveDate: '2026-06-17',
        reason: 'No change',
      })
    ).rejects.toThrow(/UTILISATION_EVENT_REQUIRES_CHANGE/);
  });

  it('protects event immutability through the model layer', async () => {
    const { aircraft } = await createTestAircraft();
    const result = await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 1,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Immutable event test',
    });

    result.event.reason = 'Changed reason';

    await expect(result.event.save()).rejects.toThrow(/UTILISATION_EVENT_IMMUTABLE/);
  });

  it('allows unrelated aircraft edits without changing utilisation', async () => {
    const { aircraft, category, model } = await createTestAircraft();
    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 5,
      newTotalTimeCycles: 1,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Set utilisation before detail edit',
    });
    const current = await Aircraft.findByPk(aircraft.id);

    await AircraftService.updateDetails(aircraft.id, {
      registration: aircraft.registration,
      serial_number: `${aircraft.serial_number}-EDIT`,
      model_id: model.id,
      category_id: category.id,
      version: current?.version,
    });

    const updated = await Aircraft.findByPk(aircraft.id);
    expect(updated?.serial_number).toBe(`${aircraft.serial_number}-EDIT`);
    expect(Number(updated?.total_time_hours)).toBe(5);
    expect(updated?.total_time_cycles).toBe(1);
  });

  it('blocks updateDetails from silently changing utilisation fields', async () => {
    const { aircraft, category, model } = await createTestAircraft();
    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 5,
      newTotalTimeCycles: 1,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Set utilisation before blocked edit',
    });
    const current = await Aircraft.findByPk(aircraft.id);

    await expect(
      AircraftService.updateDetails(aircraft.id, {
        registration: aircraft.registration,
        serial_number: aircraft.serial_number,
        model_id: model.id,
        category_id: category.id,
        total_time_hours: 6,
        total_time_cycles: 1,
        version: current?.version,
      })
    ).rejects.toThrow(/UTILISATION_CHANGE_REQUIRES_UTILISATION_SERVICE/);

    const unchanged = await Aircraft.findByPk(aircraft.id);
    expect(Number(unchanged?.total_time_hours)).toBe(5);
    expect(unchanged?.total_time_cycles).toBe(1);

    await expect(
      AircraftService.updateDetails(aircraft.id, {
        registration: aircraft.registration,
        serial_number: aircraft.serial_number,
        model_id: model.id,
        category_id: category.id,
        total_time_hours: 5,
        total_time_cycles: 2,
        version: unchanged?.version,
      })
    ).rejects.toThrow(/UTILISATION_CHANGE_REQUIRES_UTILISATION_SERVICE/);
  });
});
