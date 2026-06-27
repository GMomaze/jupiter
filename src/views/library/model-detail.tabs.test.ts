import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const template = readFileSync(
  resolve(process.cwd(), 'src/views/library/model-detail.ejs'),
  'utf8'
);

describe('component model detail tabs', () => {
  it('renders the phase one tab labels with Identity active by default', () => {
    expect(template).toContain('aria-label="Component model detail tabs"');
    expect(template).toContain('data-component-model-tab="identity"');
    expect(template).toContain('aria-controls="component-model-tab-identity"');
    expect(template).toContain('aria-selected="true"');
    expect(template).toContain('Identity');
    expect(template).toContain('Planning Data');
    expect(template).toContain('Compliance Data');
    expect(template).toContain('Maintenance Requirements');
    expect(template).toContain('Standard Tasks');
  });

  it('keeps the existing identity fields in the Identity tab', () => {
    expect(template).toContain('id="component-model-tab-identity"');
    expect(template).toContain('<%= formatModelDisplay(model || {}) %>');
    expect(template).toContain("Manufacturer: <%= model?.Manufacturer?.name || '-' %>");
    expect(template).toContain("Asset Type: <%= model?.AssetType?.code || '-' %>");
    expect(template).toContain('Applicability / OEM Model Code');
    expect(template).toContain("<%= model?.model_code || '-' %>");
  });

  it('keeps all tab panels present after the section moves', () => {
    expect(template).toContain('id="component-model-tab-planning"');
    expect(template).toContain('id="component-model-tab-compliance"');
    expect(template).toContain('id="component-model-tab-maintenance-requirements"');
    expect(template).toContain('id="component-model-tab-standard-tasks"');
    expect(template).not.toContain('This section will be moved in the next implementation phase.');
  });

  it('moves the existing compliance sections into the Compliance Data tab once', () => {
    const compliancePanelStart = template.indexOf('id="component-model-tab-compliance"');
    const maintenancePanelStart = template.indexOf('id="component-model-tab-maintenance-requirements"');
    const compliancePanel = template.slice(compliancePanelStart, maintenancePanelStart);

    expect(compliancePanel).toContain('Airworthiness Directives');
    expect(compliancePanel).toContain('action="/library/model/<%= model.id %>/airworthiness-directives/assign"');
    expect(compliancePanel).toContain('Structural Inspection Directives');
    expect(compliancePanel).toContain('action="/library/model/<%= model.id %>/sids/import?_csrf=<%= encodeURIComponent(csrfToken) %>"');
    expect(compliancePanel).toContain('action="/library/model/<%= model.id %>/sids/assign"');
    expect(compliancePanel).toContain('Attach Existing Service Bulletins');
    expect(compliancePanel).toContain('action="/library/model/<%= model.id %>/service-bulletins/attach"');
    expect(compliancePanel).toContain('action="/library/service-bulletin"');
    expect(compliancePanel).toContain('id="select-all-attachable-sbs"');
    expect(compliancePanel).toContain('id="sb-grid-body"');
    expect(compliancePanel).toContain('id="add-sb-row"');
    expect(template.match(/assignableAds\.forEach\(\(directive\) =>/g)?.length).toBe(1);
    expect(template.match(/assignedAds\.forEach\(\(directive\) =>/g)?.length).toBe(1);
    expect(template.match(/assignableSids\.forEach\(\(sid\) =>/g)?.length).toBe(1);
    expect(template.match(/attachableServiceBulletins\.forEach\(\(sb\) =>/g)?.length).toBe(1);
    expect(template.match(/serviceBulletins\.forEach\(sb =>/g)?.length).toBe(1);
  });

  it('moves the existing model planning form into the Planning Data tab once', () => {
    const planningPanelStart = template.indexOf('id="component-model-tab-planning"');
    const compliancePanelStart = template.indexOf('id="component-model-tab-compliance"');
    const planningPanel = template.slice(planningPanelStart, compliancePanelStart);

    expect(planningPanel).toContain('Model Planning Data');
    expect(planningPanel).toContain('action="/library/model/<%= model.id %>/update"');
    expect(planningPanel).toContain('name="model_name"');
    expect(planningPanel).toContain('name="maintenance_notes"');
    expect(template.match(/action="\/library\/model\/<%= model.id %>\/update"/g)?.length).toBe(1);
  });

  it('moves the existing maintenance requirements section into its tab once', () => {
    const maintenancePanelStart = template.indexOf('id="component-model-tab-maintenance-requirements"');
    const standardTasksPanelStart = template.indexOf('id="component-model-tab-standard-tasks"');
    const maintenancePanel = template.slice(maintenancePanelStart, standardTasksPanelStart);

    expect(maintenancePanel).toContain('Maintenance Requirements');
    expect(maintenancePanel).toContain('No maintenance requirements loaded.');
    expect(maintenancePanel).toContain('requirements.forEach(requirement =>');
    expect(maintenancePanel).toContain('<%= requirement.title %>');
    expect(template.match(/requirements\.forEach\(requirement =>/g)?.length).toBe(1);
  });

  it('moves the existing standard tasks section into its tab once', () => {
    const standardTasksPanelStart = template.indexOf('id="component-model-tab-standard-tasks"');
    const tabSectionEnd = template.indexOf('</section>', standardTasksPanelStart);
    const standardTasksPanel = template.slice(standardTasksPanelStart, tabSectionEnd);

    expect(standardTasksPanel).toContain('Standard Tasks');
    expect(standardTasksPanel).toContain('action="/library/model/<%= model.id %>/standard-tasks/assign"');
    expect(standardTasksPanel).toContain('name="task_template_ids"');
    expect(standardTasksPanel).toContain('assignableStandardTasks.forEach((task) =>');
    expect(standardTasksPanel).toContain('assignedStandardTasks.forEach((task) =>');
    expect(template.match(/assignableStandardTasks\.forEach\(\(task\) =>/g)?.length).toBe(1);
    expect(template.match(/assignedStandardTasks\.forEach\(\(task\) =>/g)?.length).toBe(1);
  });

  it('preserves existing form actions and csrf tokens', () => {
    expect(template).toContain('action="/library/model/<%= model.id %>/airworthiness-directives/assign"');
    expect(template).toContain('action="/library/model/<%= model.id %>/sids/import?_csrf=<%= encodeURIComponent(csrfToken) %>"');
    expect(template).toContain('action="/library/model/<%= model.id %>/sids/assign"');
    expect(template).toContain('action="/library/model/<%= model.id %>/service-bulletins/attach"');
    expect(template).toContain('action="/library/model/<%= model.id %>/standard-tasks/assign"');
    expect(template).toContain('action="/library/model/<%= model.id %>/update"');
    expect(template).toContain('action="/library/service-bulletin"');
    expect(template.match(/name="_csrf" value="<%= csrfToken %>"/g)?.length).toBe(7);
  });

  it('preserves existing model planning and service bulletin field names', () => {
    [
      'name="model_name"',
      'name="model_code"',
      'name="service_interval_hours"',
      'name="service_interval_months"',
      'name="overhaul_interval_hours"',
      'name="overhaul_interval_months"',
      'name="default_tbo_hours"',
      'name="default_tbo_months"',
      'name="is_life_limited"',
      'name="maintenance_notes"',
      'name="model_id"',
      'name="sb_number"',
      'name="title"',
      'name="description"',
      'name="compliance_type"',
      'name="issued_on"',
      'name="revision"',
      'name="document_url"',
    ].forEach((fieldName) => {
      expect(template).toContain(fieldName);
    });
  });

  it('preserves existing assignment field names and required sections', () => {
    [
      'name="airworthiness_directive_ids"',
      'name="sid_csv"',
      'name="sid_ids"',
      'name="service_bulletin_ids"',
      'name="task_template_ids"',
      'Maintenance Requirements',
      'Airworthiness Directives',
      'Structural Inspection Directives',
      'Attach Existing Service Bulletins',
      'Standard Tasks',
      'Model Planning Data',
      'Service Bulletins',
    ].forEach((expectedContent) => {
      expect(template).toContain(expectedContent);
    });
  });
});
