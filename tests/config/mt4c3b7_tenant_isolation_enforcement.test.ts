import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const protectedFiles = [
  'src/modules/aircraft/aircraft.service.ts',
  'src/modules/aircraft/aircraft-component.service.ts',
  'src/modules/aircraft/component-life-calculation.service.ts',
  'src/modules/aircraft/component-limit-monitoring.service.ts',
  'src/modules/utilisation/utilisation.service.ts',
  'src/modules/utilisation/utilisation-propagation-preview.service.ts',
  'src/modules/calendar-due/calendar-due-monitor.service.ts',
  'src/modules/compliance/compliance-due-recalculation.service.ts',
  'src/modules/tasks/scheduled-task-due-recalculation.service.ts',
] as const;
const protectedModels = new Set(['Aircraft', 'SerializedComponent', 'AircraftComponentInstallation']);
const queryMethods = new Set(['findByPk', 'findOne', 'findAll', 'count', 'create', 'update', 'destroy', 'bulkCreate']);

function violations(sourceText: string, fileName = 'synthetic.ts') {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const aliases = new Set<string>();
  const issues: string[] = [];
  const containingMethod = (node: ts.Node) => {
    for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
      if (ts.isMethodDeclaration(current)) return current.name.getText(source);
    }
    return '';
  };
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isNamedImports(statement.importClause?.namedBindings)) continue;
    for (const element of statement.importClause.namedBindings.elements) {
      if (protectedModels.has(element.propertyName?.text ?? element.name.text)) aliases.add(element.name.text);
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression;
      if (ts.isIdentifier(receiver) && aliases.has(receiver.text) && queryMethods.has(node.expression.name.text)) {
        const deferredScheduledTaskPath = fileName.endsWith('scheduled-task-due-recalculation.service.ts') &&
          containingMethod(node) === 'getAircraftSnapshot' &&
          receiver.text === 'Aircraft';
        if (!deferredScheduledTaskPath) {
          issues.push(`direct-${receiver.text}-${node.expression.name.text}`);
        }
      }
    }
    if (ts.isAsExpression(node) && node.type.getText(source).includes('TenantQueryAuthority')) {
      issues.push('structural-authority-cast');
    }
    if (ts.isObjectLiteralExpression(node) && node.properties.some((property) =>
      ts.isPropertyAssignment(property) && property.name.getText(source).replace(/["']/g, '') === 'tenantId')) {
      issues.push('structural-authority-object');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return issues;
}

describe('MT-4C3B7 tenant-isolation static enforcement', () => {
  it('keeps completed B-scope operational paths free of protected direct-model queries and forged authority', () => {
    for (const file of protectedFiles) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      expect(violations(source, file), file).toEqual([]);
    }
  });

  it('requires Aircraft and SerializedComponent root predicates in approved repositories', () => {
    const aircraft = fs.readFileSync(path.join(root, 'src/modules/aircraft/aircraft-tenant.repository.ts'), 'utf8');
    const serialized = fs.readFileSync(path.join(root, 'src/modules/library/serialized-component-tenant.repository.ts'), 'utf8');
    expect(aircraft).toContain('aircraftTenantWhere(authority');
    expect(serialized).toContain('serializedComponentTenantWhere(authority');
    expect(aircraft).toContain('assertTenantQueryAuthority(authority)');
    expect(serialized).toContain('assertTenantQueryAuthority(authority)');
  });

  it('requires both tenant roots and authentic authority for installation repositories', () => {
    const installation = fs.readFileSync(path.join(root, 'src/modules/aircraft/aircraft-component-installation-tenant.repository.ts'), 'utf8');
    expect(installation).toContain('tenant_id: authority.tenantId');
    expect(installation).toContain('custodian_tenant_id: authority.tenantId');
    expect(installation.match(/required: true/g)?.length).toBeGreaterThanOrEqual(2);
    expect(installation).toContain('assertTenantQueryAuthority(authority)');
  });

  it.each([
    ['Aircraft lookup', `import { Aircraft } from '../models/index.js'; Aircraft.findByPk(id);`],
    ['serialized lookup', `import { SerializedComponent as Part } from '../models/index.js'; Part.findOne({ where: { id } });`],
    ['installation fallback', `import { AircraftComponentInstallation } from '../models/index.js'; AircraftComponentInstallation.findAll({ where: { aircraft_id } });`],
    ['authority cast', `const authority = input as TenantQueryAuthority;`],
    ['authority shape', `repository.getById({ tenantId: tenant.id }, id);`],
  ])('rejects negative fixture: %s', (_name, source) => {
    expect(violations(source)).not.toEqual([]);
  });

  it('accepts repository-mediated authentic-authority calls', () => {
    expect(violations(`repository.getById(authority, id);`)).toEqual([]);
  });
});
