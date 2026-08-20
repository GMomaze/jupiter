import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const routes = source('./library.routes.ts');
const service = source('./library.service.ts');
const componentModel = source('../../models/ComponentModel.ts');
const migration = source('../../../migrations/585_retire_component_model_obsolete_overhaul_intervals.ts');
const manufacturerDetail = source('../../views/library/manufacturer-detail.ejs');
const modelDetail = source('../../views/library/model-detail.ejs');
const modelForm = source('../../views/library/partials/model_form.ejs');
const modelEditForm = source('../../views/library/partials/model_edit_form.ejs');
const modelList = source('../../views/library/partials/model_list.ejs');
const aircraftComponentService = source('../aircraft/aircraft-component.service.ts');
const componentLifecycleValidator = source('../aircraft/component-lifecycle.validator.ts');
const utilisationService = source('../utilisation/utilisation.service.ts');
const maintenanceTriggerService = source('../maintenance/maintenance-trigger.service.ts');
const legacyProjectionMigration = source('../../../migrations/120_component_models_asset_type_refactor.ts');

const routeWriteContract = routes.slice(
  routes.indexOf("router.post('/model'"),
  routes.indexOf("router.post('/model/:id/requirement'")
);
const serviceWriteContract = service.slice(service.indexOf('static async createModel'));

describe('component model interval consolidation', () => {
  it('presents one Service pair and one Overhaul (TBO) pair bound to authoritative fields', () => {
    for (const template of [manufacturerDetail, modelDetail, modelForm, modelEditForm]) {
      expect(template).toContain('name="service_interval_hours"');
      expect(template).toContain('name="service_interval_months"');
      expect(template).toContain('name="default_tbo_hours"');
      expect(template).toContain('name="default_tbo_months"');
      expect(template).not.toContain('name="overhaul_interval_hours"');
      expect(template).not.toContain('name="overhaul_interval_months"');
      expect(template).not.toContain('Default TBO');
    }

    expect(manufacturerDetail).toContain('Overhaul Hours (TBO)');
    expect(modelDetail).toContain('Overhaul Interval (TBO)');
    expect(modelForm).toContain('Overhaul Hours (TBO)');
    expect(modelEditForm).toContain('Overhaul Months (TBO)');
    expect(modelList).toContain('Overhaul (TBO)');
    expect(modelList).not.toContain('Default TBO');
  });

  it('limits normal create and update writes to the four authoritative interval fields', () => {
    for (const field of [
      'service_interval_hours',
      'service_interval_months',
      'default_tbo_hours',
      'default_tbo_months',
    ]) {
      expect(routeWriteContract).toContain(field);
      expect(serviceWriteContract).toContain(`${field}: data.${field} ?? null`);
    }

    expect(routeWriteContract).not.toContain('overhaul_interval_hours');
    expect(routeWriteContract).not.toContain('overhaul_interval_months');
    expect(serviceWriteContract).not.toContain('overhaul_interval_hours');
    expect(serviceWriteContract).not.toContain('overhaul_interval_months');
  });

  it('keeps blank authoritative values nullable rather than coercing them to zero', () => {
    expect(serviceWriteContract).toContain('default_tbo_hours: data.default_tbo_hours ?? null');
    expect(serviceWriteContract).toContain('default_tbo_months: data.default_tbo_months ?? null');
    expect(serviceWriteContract).toContain('service_interval_hours: data.service_interval_hours ?? null');
    expect(serviceWriteContract).toContain('service_interval_months: data.service_interval_months ?? null');
  });

  it('removes obsolete fields from ComponentModel while retaining authoritative fields', () => {
    expect(componentModel).toContain('declare service_interval_hours: number | null');
    expect(componentModel).toContain('declare service_interval_months: number | null');
    expect(componentModel).toContain('declare default_tbo_hours: number | null');
    expect(componentModel).toContain('declare default_tbo_months: number | null');
    expect(componentModel).not.toContain('overhaul_interval_hours');
    expect(componentModel).not.toContain('overhaul_interval_months');
  });

  it('retires only obsolete columns after exact schema and empty-data checks', () => {
    expect(migration).toContain("throw new Error('COMPONENT_MODEL_AUTHORITATIVE_INTERVAL_SCHEMA_INVALID')");
    expect(migration).toContain("throw new Error('COMPONENT_MODEL_OBSOLETE_INTERVAL_COLUMNS_REQUIRED')");
    expect(migration).toContain('WHERE overhaul_interval_hours IS NOT NULL');
    expect(migration).toContain('OR overhaul_interval_months IS NOT NULL');
    expect(migration).toContain("throw new Error('COMPONENT_MODEL_OBSOLETE_INTERVAL_DATA_PRESENT')");
    expect(migration).toContain('removeColumn(TABLE, OBSOLETE_HOURS');
    expect(migration).toContain('removeColumn(TABLE, OBSOLETE_MONTHS');
    expect(migration).not.toContain("removeColumn(TABLE, 'default_tbo");
    expect(migration).not.toContain("removeColumn(TABLE, 'service_interval");
  });

  it('preserves every identified legacy default TBO hours consumer', () => {
    expect(aircraftComponentService).toContain('CANNOT_INSTALL_TBO_EXCEEDED');
    expect(aircraftComponentService).toContain('CANNOT_RESTORE_TBO_EXCEEDED');
    expect(aircraftComponentService).toContain('componentModel.default_tbo_hours');
    expect(aircraftComponentService).toContain('model.default_tbo_hours');
    expect(componentLifecycleValidator).toContain('model?.default_tbo_hours');
    expect(componentLifecycleValidator).toContain('TBO_EXCEEDED');
    expect(utilisationService).toContain("attributes: ['id', 'default_tbo_hours']");
    expect(utilisationService).toContain("reason: 'TBO_EXCEEDED'");
    expect(maintenanceTriggerService).toContain('model?.default_tbo_hours');
    expect(maintenanceTriggerService).toContain('TBO WARNING');
    expect(legacyProjectionMigration).toContain('COALESCE(m.default_tbo_hours, 0) AS tbo_hours');
  });
});
