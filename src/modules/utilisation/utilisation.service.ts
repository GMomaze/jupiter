import {
  Aircraft,
  AircraftComponent,
  ComponentModel,
  UtilisationEvent,
  sequelize,
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';

type UtilisationSourceType =
  | 'MANUAL_ENTRY'
  | 'JOURNEY_LOG'
  | 'TECH_LOG'
  | 'FLIGHT_FOLIO'
  | 'INITIAL_BASELINE'
  | 'CORRECTION'
  | 'IMPORT';

type RecordUtilisationParams = {
  aircraftId: string;
  newTotalTimeHours: number | string;
  newTotalTimeCycles?: number | string | null;
  sourceType: UtilisationSourceType;
  sourceReference?: string | null;
  effectiveDate: string;
  reason: string;
  createdBy?: string | null;
  correctionOfEventId?: string | null;
  metadata?: Record<string, unknown> | null;
  transaction?: any;
};

type NormalizedUtilisationInput = {
  aircraftId: string;
  newTotalTimeHours: number;
  newTotalTimeCycles: number;
  sourceType: UtilisationSourceType;
  sourceReference: string | null;
  effectiveDate: string;
  reason: string;
  createdBy: string | null;
  correctionOfEventId: string | null;
  metadata: Record<string, unknown> | null;
};

export class UtilisationService {
  private static readonly validSourceTypes = new Set<string>([
    'MANUAL_ENTRY',
    'JOURNEY_LOG',
    'TECH_LOG',
    'FLIGHT_FOLIO',
    'INITIAL_BASELINE',
    'CORRECTION',
    'IMPORT',
  ]);

  static async recordUtilisation(params: RecordUtilisationParams) {
    const normalized = this.normalizeInput(params);

    if (params.transaction) {
      return this.recordUtilisationInTransaction(normalized, params.transaction);
    }

    return sequelize.transaction((transaction) =>
      this.recordUtilisationInTransaction(normalized, transaction)
    );
  }

  private static async recordUtilisationInTransaction(
    input: NormalizedUtilisationInput,
    transaction: any
  ) {
    const aircraft = await Aircraft.findByPk(input.aircraftId, {
      attributes: [
        'id',
        'status',
        'total_time_hours',
        'total_time_cycles',
        'version',
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!aircraft) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    const previousHours = this.normalizeHours(aircraft.total_time_hours);
    const previousCycles = this.normalizeCycles(aircraft.total_time_cycles);
    const deltaHours = Number((input.newTotalTimeHours - previousHours).toFixed(2));
    const deltaCycles = input.newTotalTimeCycles - previousCycles;
    const isCorrection = deltaHours < 0 || deltaCycles < 0;

    if (deltaHours === 0 && deltaCycles === 0) {
      throw new Error('UTILISATION_EVENT_REQUIRES_CHANGE');
    }

    if (isCorrection) {
      this.validateCorrection(input);
    }

    const event = await UtilisationEvent.create(
      {
        aircraft_id: input.aircraftId,
        source_type: isCorrection ? 'CORRECTION' : input.sourceType,
        source_reference: input.sourceReference,
        effective_date: input.effectiveDate,
        previous_total_time_hours: previousHours,
        new_total_time_hours: input.newTotalTimeHours,
        delta_hours: deltaHours,
        previous_total_time_cycles: previousCycles,
        new_total_time_cycles: input.newTotalTimeCycles,
        delta_cycles: deltaCycles,
        reason: input.reason,
        correction_of_event_id: input.correctionOfEventId,
        metadata: {
          ...(input.metadata || {}),
          correction: isCorrection,
        },
        created_by: input.createdBy,
      },
      { transaction }
    );

    const oldSnapshot = {
      total_time_hours: aircraft.total_time_hours,
      total_time_cycles: aircraft.total_time_cycles,
    };

    aircraft.total_time_hours = input.newTotalTimeHours;
    aircraft.total_time_cycles = input.newTotalTimeCycles;
    await aircraft.save({ transaction });

    await AuditService.log(
      {
        table_name: 'utilisation_events',
        row_id: event.id,
        action: 'UTILISATION_EVENT_CREATED',
        actor_id: input.createdBy,
        reason: input.reason,
        old_values: {
          aircraft_id: input.aircraftId,
          total_time_hours: previousHours,
          total_time_cycles: previousCycles,
        },
        new_values: {
          aircraft_id: input.aircraftId,
          total_time_hours: input.newTotalTimeHours,
          total_time_cycles: input.newTotalTimeCycles,
          delta_hours: deltaHours,
          delta_cycles: deltaCycles,
          source_type: event.source_type,
          source_reference: input.sourceReference,
          effective_date: input.effectiveDate,
          correction_of_event_id: input.correctionOfEventId,
          utilisation_event_id: event.id,
        },
      },
      transaction
    );

    await AuditService.log(
      {
        table_name: 'aircraft',
        row_id: aircraft.id,
        action: 'UTILISATION_SNAPSHOT_UPDATED',
        actor_id: input.createdBy,
        reason: input.reason,
        old_values: oldSnapshot,
        new_values: {
          total_time_hours: aircraft.total_time_hours,
          total_time_cycles: aircraft.total_time_cycles,
          utilisation_event_id: event.id,
        },
      },
      transaction
    );

    await this.runLegacyTboGroundingCheck({
      aircraft,
      aircraftId: input.aircraftId,
      newTotalHours: input.newTotalTimeHours,
      utilisationEventId: event.id,
      transaction,
    });

    return { aircraft, event };
  }

  private static normalizeInput(params: RecordUtilisationParams): NormalizedUtilisationInput {
    const aircraftId = String(params.aircraftId || '').trim();
    const sourceType = String(params.sourceType || '').trim().toUpperCase();
    const sourceReference = String(params.sourceReference || '').trim() || null;
    const effectiveDate = String(params.effectiveDate || '').trim();
    const reason = String(params.reason || '').trim();
    const createdBy = String(params.createdBy || '').trim() || null;
    const correctionOfEventId = String(params.correctionOfEventId || '').trim() || null;
    const newTotalTimeHours = this.parseHours(params.newTotalTimeHours);
    const newTotalTimeCycles = this.parseCycles(params.newTotalTimeCycles ?? 0);

    if (!aircraftId) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    if (!this.validSourceTypes.has(sourceType)) {
      throw new Error('INVALID_UTILISATION_SOURCE_TYPE');
    }

    if (!effectiveDate || Number.isNaN(new Date(effectiveDate).getTime())) {
      throw new Error('INVALID_EFFECTIVE_DATE');
    }

    if (!reason) {
      throw new Error('UTILISATION_REASON_REQUIRED');
    }

    return {
      aircraftId,
      newTotalTimeHours,
      newTotalTimeCycles,
      sourceType: sourceType as UtilisationSourceType,
      sourceReference,
      effectiveDate,
      reason,
      createdBy,
      correctionOfEventId,
      metadata: params.metadata || null,
    };
  }

  private static validateCorrection(input: NormalizedUtilisationInput) {
    if (!input.reason) {
      throw new Error('CORRECTION_REASON_REQUIRED');
    }

    if (!input.sourceReference) {
      throw new Error('CORRECTION_SOURCE_REFERENCE_REQUIRED');
    }
  }

  private static parseHours(value: number | string) {
    const hours = Number(value);

    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error('INVALID_TOTAL_TIME_HOURS');
    }

    return Number(hours.toFixed(2));
  }

  private static parseCycles(value: number | string | null) {
    const cycles = Number(value ?? 0);

    if (!Number.isInteger(cycles) || cycles < 0) {
      throw new Error('INVALID_TOTAL_TIME_CYCLES');
    }

    return cycles;
  }

  private static normalizeHours(value: unknown) {
    return this.parseHours(typeof value === 'string' || typeof value === 'number' ? value : 0);
  }

  private static normalizeCycles(value: unknown) {
    return this.parseCycles(typeof value === 'string' || typeof value === 'number' ? value : 0);
  }

  private static async runLegacyTboGroundingCheck(params: {
    aircraft: Aircraft;
    aircraftId: string;
    newTotalHours: number;
    utilisationEventId: string;
    transaction: any;
  }) {
    const installed = await AircraftComponent.findAll({
      where: { aircraft_id: params.aircraftId },
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'default_tbo_hours'],
        },
      ],
      transaction: params.transaction,
    });

    for (const record of installed) {
      const model = (record as any).ComponentModel;
      if (!model?.default_tbo_hours) continue;

      const hoursSinceInstall =
        params.newTotalHours - Number(record.install_af_hours || 0);
      const componentTotalTime =
        Number(record.tsn_at_install || 0) + hoursSinceInstall;

      if (componentTotalTime >= Number(model.default_tbo_hours)) {
        if (params.aircraft.status === 'ACTIVE') {
          const oldStatus = params.aircraft.status;
          params.aircraft.status = 'GROUNDED';
          await params.aircraft.save({ transaction: params.transaction });

          await AuditService.log(
            {
              table_name: 'aircraft',
              row_id: params.aircraftId,
              action: 'STATUS_CHANGE',
              actor_id: null,
              reason: 'TBO_EXCEEDED',
              old_values: {
                status: oldStatus,
                utilisation_event_id: params.utilisationEventId,
              },
              new_values: {
                status: 'GROUNDED',
                utilisation_event_id: params.utilisationEventId,
              },
            },
            params.transaction
          );
        }

        break;
      }
    }
  }
}
