import { WorkpackMeasurement } from '../../../models/index.js';

export class MeasurementService {
  static readonly CAPTURED_VALUES_START = '[Captured Values]';
  static readonly CAPTURED_VALUES_END = '[/Captured Values]';

  static getMeasurementDefinitions(description: string | null | undefined) {
    return Array.from(String(description || '').matchAll(/\[([^\]]*)\]/g)).map((match, index) => {
      const rawLabel = String(match[1] || '').trim();
      return {
        key: `field_${index}`,
        label: rawLabel || `Value ${index + 1}`,
        position: index + 1,
      };
    });
  }

  static splitWorkPerformed(workPerformed: string | null | undefined) {
    const value = String(workPerformed || '').trim();
    const start = value.indexOf(this.CAPTURED_VALUES_START);
    const end = value.indexOf(this.CAPTURED_VALUES_END);

    if (start === -1 || end === -1 || end < start) {
      return { captured: '', note: value };
    }

    const captured = value
      .slice(start + this.CAPTURED_VALUES_START.length, end)
      .trim();
    const before = value.slice(0, start).trim();
    const after = value
      .slice(end + this.CAPTURED_VALUES_END.length)
      .trim();

    return {
      captured,
      note: [before, after].filter(Boolean).join('\n\n').trim(),
    };
  }

  static extractCleanWorkPerformedNote(workPerformed: string | null | undefined) {
    return this.splitWorkPerformed(workPerformed).note || null;
  }

  static parseCapturedValues(captured: string) {
    const values = new Map<string, string>();

    captured
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) {
          return;
        }

        const label = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();

        if (!label) {
          return;
        }

        values.set(label, value);
      });

    return values;
  }

  static parseStructuredMeasurements(
    taskDescription: string | null | undefined,
    measurementsPayload: unknown
  ) {
    if (
      measurementsPayload === undefined ||
      measurementsPayload === null ||
      (typeof measurementsPayload === 'string' && measurementsPayload.trim() === '')
    ) {
      return null;
    }

    let parsedPayload: any;

    if (typeof measurementsPayload === 'string') {
      try {
        parsedPayload = JSON.parse(measurementsPayload);
      } catch {
        return null;
      }
    } else {
      parsedPayload = measurementsPayload;
    }

    if (!Array.isArray(parsedPayload)) {
      return null;
    }

    const definitions = this.getMeasurementDefinitions(taskDescription);
    const valuesByKey = new Map<string, string | null>();
    const valuesByLabel = new Map<string, string | null>();
    const valuesByPosition = new Map<number, string | null>();

    parsedPayload.forEach((entry: any, index: number) => {
      if (!entry || typeof entry !== 'object') {
        return;
      }

      const fieldKey = String(entry.field_key || '').trim();
      const fieldLabel = String(entry.field_label || '').trim();
      const rawPosition = Number(entry.position);
      const value = String(entry.value ?? '').trim() || null;

      if (fieldKey) {
        valuesByKey.set(fieldKey, value);
      }

      if (fieldLabel) {
        valuesByLabel.set(fieldLabel, value);
      }

      if (Number.isFinite(rawPosition) && rawPosition > 0) {
        valuesByPosition.set(rawPosition, value);
      } else {
        valuesByPosition.set(index + 1, value);
      }
    });

    return definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value:
        valuesByKey.get(definition.key) ??
        valuesByPosition.get(definition.position) ??
        valuesByLabel.get(definition.label) ??
        null,
    }));
  }

  static buildMeasurementSnapshot(
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload?: unknown
  ) {
    const structuredMeasurements = this.parseStructuredMeasurements(
      taskDescription,
      measurementsPayload
    );

    if (structuredMeasurements) {
      return structuredMeasurements;
    }

    const definitions = this.getMeasurementDefinitions(taskDescription);
    const { captured } = this.splitWorkPerformed(workPerformed);
    const capturedValues = this.parseCapturedValues(captured);

    return definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value: capturedValues.get(definition.label) || null,
    }));
  }

  static async syncExecutionMeasurements(
    executionId: string,
    taskDescription: string | null | undefined,
    workPerformed: string | null | undefined,
    measurementsPayload: unknown,
    transaction: any
  ) {
    const structuredMeasurements = this.parseStructuredMeasurements(
      taskDescription,
      measurementsPayload
    );
    const definitions = this.getMeasurementDefinitions(taskDescription);
    const { captured } = this.splitWorkPerformed(workPerformed);
    const capturedValues = this.parseCapturedValues(captured);
    const measurementRows = structuredMeasurements || definitions.map((definition) => ({
      field_key: definition.key,
      field_label: definition.label,
      position: definition.position,
      value: capturedValues.get(definition.label) || null,
    }));

    await WorkpackMeasurement.destroy({
      where: { execution_id: executionId },
      transaction,
    });

    if (measurementRows.length === 0) {
      return;
    }

    await WorkpackMeasurement.bulkCreate(
      measurementRows.map((definition) => ({
        execution_id: executionId,
        field_key: definition.field_key,
        field_label: definition.field_label,
        position: definition.position,
        value: definition.value || null,
      })),
      { transaction }
    );
  }
}
