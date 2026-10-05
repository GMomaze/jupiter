import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type RootModel = 'Aircraft' | 'Customer';
type Occurrence = { model: RootModel; identity: string };
type Analysis = { occurrences: Occurrence[]; issues: string[] };

const root = process.cwd();
const sourceRoot = path.join(root, 'src');
const posix = (value: string) => value.replaceAll('\\', '/');
const relative = (value: string) => posix(path.relative(root, value));

function productionFiles(directory = sourceRoot): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionFiles(target);
    return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
      ? [target]
      : [];
  });
}

function propertyName(node: ts.PropertyName | ts.BindingName | undefined): string {
  if (!node) return 'anonymous';
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)
    ? node.text
    : node.getText();
}

function owner(node: ts.Node): string {
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isMethodDeclaration(current) || ts.isFunctionDeclaration(current)) {
      return propertyName(current.name);
    }
    if (ts.isPropertyDeclaration(current)) return `property:${propertyName(current.name)}`;
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const parent = current.parent;
      if (ts.isPropertyAssignment(parent)) return `property:${propertyName(parent.name)}`;
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)) {
        const route = parent.arguments[0];
        if (route && ts.isStringLiteral(route)) return `route:${route.text}`;
      }
    }
  }
  return 'module';
}

function normalizedModuleSpecifier(specifier: string): string {
  return specifier.replaceAll('\\', '/');
}

function isApprovedModelsModuleSpecifier(specifier: string): boolean {
  return /(?:^|\/)models(?:\/index)?(?:\.js)?$/.test(normalizedModuleSpecifier(specifier));
}

function directRootModelSpecifier(specifier: string): RootModel | undefined {
  const normalized = normalizedModuleSpecifier(specifier);
  if (/(?:^|\/)models\/core\/Aircraft(?:\.js)?$/.test(normalized)) return 'Aircraft';
  if (/(?:^|\/)models\/Customer(?:\.js)?$/.test(normalized)) return 'Customer';
  return undefined;
}

function isApprovedRootModelModuleSpecifier(specifier: string): boolean {
  return isApprovedModelsModuleSpecifier(specifier) || directRootModelSpecifier(specifier) !== undefined;
}

function importedModels(source: ts.SourceFile): Map<string, RootModel> {
  const aliases = new Map<string, RootModel>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!isApprovedRootModelModuleSpecifier(specifier)) continue;
    const directModel = directRootModelSpecifier(specifier);
    if (directModel && statement.importClause?.name) {
      aliases.set(statement.importClause.name.text, directModel);
    }
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (directModel && imported === 'default') {
        aliases.set(element.name.text, directModel);
      } else if (imported === 'Aircraft' || imported === 'Customer') {
        aliases.set(element.name.text, imported);
      }
    }
  }
  return aliases;
}

function importedModelNamespaces(source: ts.SourceFile): Set<string> {
  const namespaces = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!isApprovedModelsModuleSpecifier(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
  }
  return namespaces;
}

const guardedOperations = new Set([
  'findByPk', 'findOne', 'findAll', 'count', 'create', 'update', 'destroy',
  'bulkCreate', 'bulkUpdate', 'increment', 'decrement', 'save',
]);

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(ts.getModifiers(node as ts.HasModifiers)?.some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  ));
}

function analyzeSource(source: ts.SourceFile, file: string): Analysis {
  const modelAliases = importedModels(source);
  const modelNamespaces = importedModelNamespaces(source);
  const methodAliases = new Map<string, { model: RootModel; operation: string }>();
  const stringConstants = new Map<string, string>();
  const exportedNames = new Set<string>();
  const issues: string[] = [];

  const resolveNamespaceModel = (expression: ts.Expression) => {
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      if (!modelNamespaces.has(expression.expression.text)) return undefined;
      return expression.name.text === 'Aircraft' || expression.name.text === 'Customer'
        ? { model: expression.name.text as RootModel, dynamic: false }
        : undefined;
    }
    if (ts.isElementAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      if (!modelNamespaces.has(expression.expression.text)) return undefined;
      const argument = expression.argumentExpression;
      const name = argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
        ? argument.text
        : argument && ts.isIdentifier(argument)
          ? stringConstants.get(argument.text)
          : undefined;
      if (name === 'Aircraft' || name === 'Customer') {
        return { model: name as RootModel, dynamic: false };
      }
      return name === undefined ? { model: undefined, dynamic: true } : undefined;
    }
    return undefined;
  };

  const resolveModelExpression = (expression: ts.Expression): RootModel | undefined => {
    if (ts.isParenthesizedExpression(expression)) {
      return resolveModelExpression(expression.expression);
    }
    if (ts.isIdentifier(expression)) return modelAliases.get(expression.text);
    return resolveNamespaceModel(expression)?.model;
  };

  const resolveMember = (expression: ts.Expression) => {
    if (ts.isPropertyAccessExpression(expression)) {
      const model = resolveModelExpression(expression.expression);
      return model ? { model, operation: expression.name.text, dynamic: false } : undefined;
    }
    if (ts.isElementAccessExpression(expression)) {
      const model = resolveModelExpression(expression.expression);
      if (!model) return undefined;
      const argument = expression.argumentExpression;
      if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
        return { model, operation: argument.text, dynamic: false };
      }
      if (argument && ts.isIdentifier(argument) && stringConstants.has(argument.text)) {
        return { model, operation: stringConstants.get(argument.text)!, dynamic: false };
      }
      return { model, operation: '<dynamic>', dynamic: true };
    }
    return undefined;
  };

  let changed = true;
  while (changed) {
    changed = false;
    const discover = (node: ts.Node): void => {
      if (ts.isVariableStatement(node) && hasExportModifier(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) exportedNames.add(declaration.name.text);
        }
      }
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exportedNames.add(element.propertyName?.text ?? element.name.text);
        }
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const specifier = node.moduleSpecifier.text;
          const directModel = directRootModelSpecifier(specifier) !== undefined;
          const rootFromIndex = isApprovedModelsModuleSpecifier(specifier) &&
            node.exportClause.elements.some((element) => {
              const imported = element.propertyName?.text ?? element.name.text;
              return imported === 'Aircraft' || imported === 'Customer';
            });
          if (directModel || rootFromIndex) {
            issues.push(`${relative(file)}|module|root-model-re-export`);
          }
        }
      }
      if (ts.isExportAssignment(node)) {
        const model = resolveModelExpression(node.expression);
        if (model) issues.push(`${relative(file)}|module|exported-${model}-model-object`);
      }
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name)) {
          const name = node.name.text;
          if (
            (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
            !stringConstants.has(name)
          ) {
            stringConstants.set(name, node.initializer.text);
            changed = true;
          }
          if (ts.isIdentifier(node.initializer)) {
            const model = modelAliases.get(node.initializer.text);
            if (model && !modelAliases.has(name)) {
              modelAliases.set(name, model);
              changed = true;
            }
            const method = methodAliases.get(node.initializer.text);
            if (method && !methodAliases.has(name)) {
              methodAliases.set(name, method);
              changed = true;
            }
            if (modelNamespaces.has(node.initializer.text) && !modelNamespaces.has(name)) {
              modelNamespaces.add(name);
              changed = true;
            }
          }
          const namespaceModel = resolveModelExpression(node.initializer);
          if (namespaceModel && !modelAliases.has(name)) {
            modelAliases.set(name, namespaceModel);
            changed = true;
          }
          const directMember = resolveMember(node.initializer);
          if (directMember?.dynamic) issues.push(`${relative(file)}|${name}|unresolved-computed-model-access`);
          if (directMember && !directMember.dynamic && guardedOperations.has(directMember.operation) && !methodAliases.has(name)) {
            methodAliases.set(name, directMember);
            changed = true;
          }
          if (
            ts.isCallExpression(node.initializer) &&
            ts.isPropertyAccessExpression(node.initializer.expression) &&
            node.initializer.expression.name.text === 'bind'
          ) {
            const bound = resolveMember(node.initializer.expression.expression);
            if (bound?.dynamic) issues.push(`${relative(file)}|${name}|unresolved-bound-model-access`);
            if (bound && !bound.dynamic && guardedOperations.has(bound.operation) && !methodAliases.has(name)) {
              methodAliases.set(name, bound);
              changed = true;
            }
          }
        } else if (ts.isObjectBindingPattern(node.name) && ts.isIdentifier(node.initializer)) {
          const model = modelAliases.get(node.initializer.text);
          if (model) {
            for (const element of node.name.elements) {
              if (!ts.isIdentifier(element.name)) continue;
              const operation = element.propertyName ? propertyName(element.propertyName) : element.name.text;
              if (guardedOperations.has(operation) && !methodAliases.has(element.name.text)) {
                methodAliases.set(element.name.text, { model, operation });
                changed = true;
              }
            }
          }
          if (modelNamespaces.has(node.initializer.text)) {
            for (const element of node.name.elements) {
              if (!ts.isIdentifier(element.name)) continue;
              const imported = element.propertyName ? propertyName(element.propertyName) : element.name.text;
              if ((imported === 'Aircraft' || imported === 'Customer') && !modelAliases.has(element.name.text)) {
                modelAliases.set(element.name.text, imported);
                changed = true;
              }
            }
          }
        }
      }
      ts.forEachChild(node, discover);
    };
    discover(source);
  }

  for (const name of exportedNames) {
    if (modelAliases.has(name)) issues.push(`${relative(file)}|${name}|exported-model-alias`);
    if (methodAliases.has(name)) issues.push(`${relative(file)}|${name}|exported-model-method`);
  }

  const occurrences: Occurrence[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && modelNamespaces.has(node.text)) {
      const parent = node.parent;
      const isImportBinding = ts.isNamespaceImport(parent);
      const isDeclarationName = ts.isVariableDeclaration(parent) && parent.name === node;
      const isNamespaceAliasInitializer =
        ts.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        ts.isIdentifier(parent.name) &&
        modelNamespaces.has(parent.name.text);
      const isDestructuringInitializer =
        ts.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        ts.isObjectBindingPattern(parent.name);
      const isNamespaceReceiver =
        (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
        parent.expression === node;
      const isAccessName = ts.isPropertyAccessExpression(parent) && parent.name === node;
      if (
        !isImportBinding &&
        !isDeclarationName &&
        !isNamespaceAliasInitializer &&
        !isDestructuringInitializer &&
        !isNamespaceReceiver &&
        !isAccessName
      ) {
        issues.push(`${relative(file)}|${owner(node)}|escaped-model-namespace`);
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const namespaceModel = resolveNamespaceModel(node);
      if (namespaceModel?.dynamic) {
        issues.push(`${relative(file)}|${owner(node)}|unresolved-model-namespace-access`);
      }
      if (namespaceModel?.model) {
        const parent = node.parent;
        const isAliasInitializer =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === node &&
          ts.isIdentifier(parent.name) &&
          modelAliases.get(parent.name.text) === namespaceModel.model;
        const isMemberReceiver =
          (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
          parent.expression === node;
        const boundMember =
          ts.isCallExpression(parent) &&
          ts.isPropertyAccessExpression(parent.expression) &&
          parent.expression.name.text === 'bind'
            ? resolveMember(parent.expression.expression)
            : undefined;
        const isMatchingGuardedBindReceiver =
          ts.isCallExpression(parent) &&
          parent.arguments[0] === node &&
          boundMember !== undefined &&
          !boundMember.dynamic &&
          guardedOperations.has(boundMember.operation) &&
          boundMember.model === namespaceModel.model;
        const isHandledExport = ts.isExportAssignment(parent);
        if (!isAliasInitializer && !isMemberReceiver && !isMatchingGuardedBindReceiver && !isHandledExport) {
          issues.push(`${relative(file)}|${owner(node)}|escaped-${namespaceModel.model}-model-object`);
        }
      }
    }
    if (ts.isIdentifier(node)) {
      const model = modelAliases.get(node.text);
      if (model) {
        const parent = node.parent;
        const isImportBinding =
          ts.isImportSpecifier(parent) ||
          ts.isImportClause(parent) ||
          ts.isNamespaceImport(parent);
        let typeAncestor: ts.Node | undefined = parent;
        let isTypeOnlyReference = false;
        while (typeAncestor && !ts.isStatement(typeAncestor)) {
          if (ts.isTypeNode(typeAncestor)) {
            isTypeOnlyReference = true;
            break;
          }
          typeAncestor = typeAncestor.parent;
        }
        const isDeclarationName =
          (ts.isVariableDeclaration(parent) ||
            ts.isParameter(parent) ||
            ts.isFunctionDeclaration(parent) ||
            ts.isClassDeclaration(parent) ||
            ts.isBindingElement(parent)) &&
          parent.name === node;
        const isAliasInitializer =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === node &&
          ts.isIdentifier(parent.name) &&
          modelAliases.get(parent.name.text) === model;
        const isDestructuringInitializer =
          ts.isVariableDeclaration(parent) &&
          parent.initializer === node &&
          ts.isObjectBindingPattern(parent.name);
        const isMemberReceiver =
          (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
          parent.expression === node;
        const isHandledExport =
          ts.isExportAssignment(parent) || ts.isExportSpecifier(parent);
        const isPropertyName =
          (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent)) &&
          parent.name === node;
        const isAccessName =
          ts.isPropertyAccessExpression(parent) && parent.name === node;
        const boundMember =
          ts.isCallExpression(parent) &&
          ts.isPropertyAccessExpression(parent.expression) &&
          parent.expression.name.text === 'bind'
            ? resolveMember(parent.expression.expression)
            : undefined;
        const isMatchingGuardedBindReceiver =
          ts.isCallExpression(parent) &&
          parent.arguments[0] === node &&
          boundMember !== undefined &&
          !boundMember.dynamic &&
          guardedOperations.has(boundMember.operation) &&
          boundMember.model === model;
        const isExactRelationshipBinding =
          relative(file) === 'src/modules/customers/customer-aircraft-link-tenant.live.ts' &&
          ts.isNewExpression(parent) &&
          ts.isIdentifier(parent.expression) &&
          parent.expression.text === 'CustomerAircraftLinkTenantRepository' &&
          parent.arguments?.length === 5 &&
          (model === 'Customer'
            ? parent.arguments[3] === node
            : parent.arguments[4] === node);
        const includeIdentity = `${relative(file)}|${owner(node)}|include`;
        const isModelPropertyReference =
          ts.isPropertyAssignment(parent) &&
          propertyName(parent.name) === 'model' &&
          parent.initializer === node;
        const isExactApprovedInclude =
          isModelPropertyReference &&
          (model === 'Aircraft'
            ? aircraftExpected[includeIdentity] !== undefined
            : customerExpected[includeIdentity] !== undefined);

        if (isModelPropertyReference && !isExactApprovedInclude) {
          issues.push(`${relative(file)}|${owner(node)}|unapproved-${model}-model-include`);
        }

        if (
          !isImportBinding &&
          !isTypeOnlyReference &&
          !isDeclarationName &&
          !isAliasInitializer &&
          !isDestructuringInitializer &&
          !isMemberReceiver &&
          !isHandledExport &&
          !isPropertyName &&
          !isAccessName &&
          !isMatchingGuardedBindReceiver &&
          !isExactRelationshipBinding &&
          !isModelPropertyReference
        ) {
          issues.push(`${relative(file)}|${owner(node)}|escaped-${model}-model-object`);
        }
      }
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const member = resolveMember(node);
      const parent = node.parent;
      const handledAsDirectCall = ts.isCallExpression(parent) && parent.expression === node;
      const handledAsBoundMember =
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node &&
        parent.name.text === 'bind';
      if (!handledAsDirectCall && !handledAsBoundMember) {
        if (member?.dynamic) {
          issues.push(`${relative(file)}|${owner(node)}|unresolved-computed-model-reference`);
        }
        if (member && !member.dynamic && guardedOperations.has(member.operation)) {
          occurrences.push({
            model: member.model,
            identity: `${relative(file)}|${owner(node)}|reference:${member.operation}`,
          });
        }
      }
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const method = methodAliases.get(node.expression.text);
        if (method) {
          occurrences.push({
            model: method.model,
            identity: `${relative(file)}|${owner(node)}|call:${method.operation}`,
          });
        }
      } else {
        const direct = resolveMember(node.expression);
        if (direct?.dynamic) issues.push(`${relative(file)}|${owner(node)}|unresolved-computed-model-call`);
        if (direct && !direct.dynamic && guardedOperations.has(direct.operation)) {
          occurrences.push({
            model: direct.model,
            identity: `${relative(file)}|${owner(node)}|call:${direct.operation}`,
          });
        }
        if (
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'bind'
        ) {
          const bound = resolveMember(node.expression.expression);
          if (bound?.dynamic) issues.push(`${relative(file)}|${owner(node)}|unresolved-bound-model-call`);
          if (bound && !bound.dynamic && guardedOperations.has(bound.operation)) {
            occurrences.push({
              model: bound.model,
              identity: `${relative(file)}|${owner(node)}|reference:${bound.operation}`,
            });
          }
        }
      }
      if (
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0]) &&
        isApprovedRootModelModuleSpecifier(node.arguments[0].text)
      ) {
        issues.push(`${relative(file)}|${owner(node)}|dynamic-or-require-model-import`);
      }
    }
    if (
      ts.isPropertyAssignment(node) && propertyName(node.name) === 'model' &&
      ts.isIdentifier(node.initializer)
    ) {
      const model = modelAliases.get(node.initializer.text);
      if (model) occurrences.push({ model, identity: `${relative(file)}|${owner(node)}|include` });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { occurrences, issues: [...new Set(issues)].sort() };
}

function collectOccurrences(): Occurrence[] {
  const result: Occurrence[] = [];
  for (const file of productionFiles()) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, file);
    expect(analysis.issues).toEqual([]);
    result.push(...analysis.occurrences);
  }
  return result;
}

function counted(values: string[]): Record<string, number> {
  return Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
  );
}

const aircraftExpected: Record<string, number> = {
  'src/modules/aircraft/aircraft.controller.ts|attachServiceBulletinCompliance|include': 1,
  'src/modules/aircraft/aircraft.controller.ts|showView|call:findOne': 1,
  'src/modules/aircraft/aircraft.controller.ts|showApplicability|call:findOne': 1,
  'src/modules/aircraft/aircraft.controller.ts|showByRegistration|call:findOne': 1,
  'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:findOne|call:findOne': 1,
  'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:findAll|call:findAll': 1,
  'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:count|call:count': 1,
  'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:create|call:create': 1,
  'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:update|call:update': 1,
  'src/modules/dashboard/dashboard-tenant.repository.live.ts|property:count|call:count': 1,
  'src/modules/library/library.service.ts|getSerializedComponentById|include': 1,
  'src/modules/library/library.service.ts|getSerializedComponentLifeDashboard|include': 1,
  'src/modules/tasks/scheduled-task-due-recalculation.service.ts|getAircraftSnapshot|call:findByPk': 1,
  'src/modules/workpacks/services/planning-session.service.ts|listSessionsForUser|include': 1,
  'src/modules/workpacks/services/planning-session.service.ts|getSessionForUser|include': 1,
  'src/modules/workpacks/services/workpack-planning.service.ts|addTaskFromTemplate|call:findByPk': 1,
  'src/modules/workpacks/services/workpack-service-bulletin.service.ts|getOpenRelevantServiceBulletinsForAircraft|call:findByPk': 1,
  'src/modules/workpacks/workpack.controller.ts|property:workpackAircraftInclude|include': 1,
};

const customerExpected: Record<string, number> = {
  'src/modules/aircraft/aircraft.controller.ts|showView|include': 1,
  'src/modules/aircraft/aircraft.controller.ts|showByRegistration|include': 1,
  'src/modules/customers/customer-tenant.repository.live.ts|property:findOne|call:findOne': 1,
  'src/modules/customers/customer-tenant.repository.live.ts|property:findAll|call:findAll': 1,
  'src/modules/customers/customer-tenant.repository.live.ts|property:count|call:count': 1,
  'src/modules/customers/customer-tenant.repository.live.ts|property:create|call:create': 1,
  'src/modules/customers/customer-tenant.repository.live.ts|property:update|call:update': 1,
  'src/modules/dashboard/dashboard-tenant.repository.live.ts|property:count|call:count': 1,
};

const aircraftRawExpected: Record<string, number> = {
  'src/modules/compliance/applicability-engine.service.ts': 1,
  'src/modules/compliance/compliance.service.ts': 6,
  'src/modules/customer-portal/customer-portal.repository.live.ts': 4,
  'src/modules/dashboard/dashboard-tenant.repository.live.ts': 1,
  'src/modules/inventory/inventory.service.ts': 2,
  'src/modules/library/library.service.ts': 2,
  'src/modules/migration/migration-dry-run.service.ts': 1,
  'src/modules/projection/projection.controller.ts': 1,
  'src/modules/workpacks/pdf.crma.ts': 1,
  'src/modules/workpacks/pdf.release.ts': 1,
  'src/modules/workpacks/pdf.service.ts': 1,
  'src/modules/workpacks/services/crma-data.service.ts': 1,
  'src/modules/workpacks/services/crs-data.service.ts': 2,
  'src/modules/workpacks/services/printable-workpack.service.ts': 1,
  'src/modules/workpacks/workpack-tenant.repository.ts': 1,
  'src/modules/workpacks/workpack.controller.ts': 1,
};

function rawTableCounts(table: RootModel): Record<string, number> {
  const tableName = table === 'Aircraft' ? 'aircraft' : 'customers';
  const pattern = new RegExp(`\\b(?:from|join)\\s+(?:public\\.)?${tableName}\\b`, 'gi');
  const entries: string[] = [];
  for (const file of productionFiles()) {
    const count = fs.readFileSync(file, 'utf8').match(pattern)?.length ?? 0;
    entries.push(...Array.from({ length: count }, () => relative(file)));
  }
  return counted(entries);
}

describe('4C3A6 consolidated tenant-root direct-model boundary', () => {
  const occurrences = collectOccurrences();

  it.each([
    'models', 'models.js', 'models/index', 'models/index.js', './models',
    './models/index.js', '../models', '../models/index.js', '../../models/index.js',
  ])('accepts exact models-module identity %s', (specifier) => {
    expect(isApprovedModelsModuleSpecifier(specifier)).toBe(true);
  });

  it.each([
    'fake-models', 'fake-models.js', 'fake-models/index', 'fake-models/index.js',
    'othermodels', 'othermodels.js', 'othermodels/index', 'othermodels/index.js',
    'foo/fake-models/index.js', 'foo/othermodels/index.js', 'models-extra',
    'models-old/index.js', 'models2', 'models2/index.js', 'customer-models/index.js',
  ])('rejects lookalike models-module identity %s', (specifier) => {
    expect(isApprovedModelsModuleSpecifier(specifier)).toBe(false);
  });

  it.each([
    ['named import', "import { Aircraft } from '../models/index.js'; consume(Aircraft);"],
    ['namespace import', "import * as registry from '../models/index.js'; consume(registry.Aircraft);"],
    ['re-export', "export { Aircraft } from '../models/index.js';"],
    ['require', "require('../models/index.js');"],
    ['dynamic import', "import('../models/index.js');"],
  ])('recognizes approved module identity through %s', (_name, body) => {
    const source = ts.createSourceFile('synthetic.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.occurrences.length + analysis.issues.length).toBeGreaterThan(0);
  });

  it.each([
    ['named import', "import { Aircraft } from '../fake-models/index.js'; consume(Aircraft);"],
    ['namespace import', "import * as models from '../othermodels/index.js'; models.Customer;"],
    ['re-export', "export { Customer } from '../fake-models/index.js';"],
    ['require', "require('../othermodels/index.js');"],
    ['dynamic import', "import('../fake-models/index.js');"],
  ])('ignores wrong-module lookalike through %s', (_name, body) => {
    const source = ts.createSourceFile('synthetic.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(analyzeSource(source, path.join(root, 'synthetic.ts'))).toEqual({ occurrences: [], issues: [] });
  });

  it('matches the exact Aircraft adapter and deferred production identities', () => {
    const actual = counted(occurrences.filter((item) => item.model === 'Aircraft').map((item) => item.identity));
    expect(actual).toEqual(aircraftExpected);
    expect(Object.values(actual).reduce((sum, count) => sum + count, 0)).toBe(18);
  });

  it('matches the exact Customer adapter, portal, dashboard, and inverse identities', () => {
    const actual = counted(occurrences.filter((item) => item.model === 'Customer').map((item) => item.identity));
    expect(actual).toEqual(customerExpected);
    expect(Object.values(actual).reduce((sum, count) => sum + count, 0)).toBe(8);
  });

  it('moves all five customer-session portal contexts behind portal authority', () => {
    const portal = fs.readFileSync(path.join(sourceRoot, 'modules/customer-portal/customer-portal.routes.ts'), 'utf8');
    expect(portal).not.toMatch(/Customer\.findByPk|Aircraft\.find|sequelize\.query/);
    for (const route of ["'/'", "'/aircraft'", "'/workpacks'", "'/documents'", "'/compliance'"]) {
      expect(portal).toContain(`router.get(${route}`);
    }
    expect(portal).toContain('req.customerPortalAuthority');
    expect(portal).not.toMatch(/TenantQueryAuthority|req\.tenantAuthority/);
    expect(portal).toContain('resolveCustomerPortalAuthority');
  });

  it('keeps converted root operations repository-backed and mutation-adapter-only', () => {
    const aircraftService = fs.readFileSync(path.join(sourceRoot, 'modules/aircraft/aircraft.service.ts'), 'utf8');
    const customerService = fs.readFileSync(path.join(sourceRoot, 'modules/customers/customers.service.ts'), 'utf8');
    for (const method of ['getById', 'getByRegistration', 'list', 'create', 'ground', 'retire', 'returnToService', 'updateDetails']) {
      const start = aircraftService.indexOf(`static async ${method}`);
      expect(start).toBeGreaterThan(-1);
      expect(aircraftService.slice(start, start + 1800)).not.toMatch(/\bAircraft\.(?:findByPk|findOne|findAll|count|create|update|destroy)/);
    }
    expect(customerService).not.toMatch(/\bCustomer\.(?:findByPk|findOne|findAll|count|create|update|destroy)/);
    const mutations = occurrences.filter((item) => /call:(?:create|update|destroy|bulkCreate|bulkUpdate)$/.test(item.identity));
    expect(mutations.map((item) => item.identity).sort()).toEqual([
      'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:create|call:create',
      'src/modules/aircraft/aircraft-tenant.repository.live.ts|property:update|call:update',
      'src/modules/customers/customer-tenant.repository.live.ts|property:create|call:create',
      'src/modules/customers/customer-tenant.repository.live.ts|property:update|call:update',
    ]);
  });

  it('matches the exact deferred raw Aircraft and Customer SQL classifications', () => {
    expect(rawTableCounts('Aircraft')).toEqual(aircraftRawExpected);
    expect(Object.values(aircraftRawExpected).reduce((sum, count) => sum + count, 0)).toBe(30);
    expect(rawTableCounts('Customer')).toEqual({
      'src/modules/customer-portal/customer-portal.repository.live.ts': 5,
      'src/modules/workpacks/services/printable-workpack.service.ts': 1,
    });
  });

  it('enforces pure/live bindings and rejects import/re-export escapes', () => {
    const aircraftPure = fs.readFileSync(path.join(sourceRoot, 'modules/aircraft/aircraft-tenant.repository.ts'), 'utf8');
    const customerPure = fs.readFileSync(path.join(sourceRoot, 'modules/customers/customer-tenant.repository.ts'), 'utf8');
    const aircraftLive = fs.readFileSync(path.join(sourceRoot, 'modules/aircraft/aircraft-tenant.repository.live.ts'), 'utf8');
    const customerLive = fs.readFileSync(path.join(sourceRoot, 'modules/customers/customer-tenant.repository.live.ts'), 'utf8');
    const relationshipLive = fs.readFileSync(path.join(sourceRoot, 'modules/customers/customer-aircraft-link-tenant.live.ts'), 'utf8');
    expect(aircraftPure + customerPure).not.toMatch(/models\/|database\.js|from ['"]pg['"]/);
    expect(aircraftLive).toMatch(/import \{ Aircraft \}.*models\/index\.js/);
    expect(customerLive).toMatch(/import \{ Customer \}.*models\/index\.js/);
    expect(relationshipLive).toMatch(/customerTenantRepository[\s\S]*aircraftTenantRepository[\s\S]*AuditService/);
    expect(relationshipLive).not.toMatch(/\b(?:Aircraft|Customer)\.(?:findByPk|findOne|findAll|count|create|update|destroy)/);

    const production = productionFiles().map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(production).not.toMatch(/require\([^)]*(?:Aircraft|Customer)|import\([^)]*(?:Aircraft|Customer)/);
    const unexpectedReexports = productionFiles()
      .filter((file) => !/[\\/]models[\\/]index\.ts$/.test(file))
      .filter((file) => /export\s+\{[^}]*(?:Aircraft|Customer)[^}]*\}\s+from/.test(fs.readFileSync(file, 'utf8')));
    expect(unexpectedReexports).toEqual([]);
  });

  it('preserves authority, gate, global-state, and migration boundaries', () => {
    const operational = [
      'modules/aircraft/aircraft.service.ts',
      'modules/aircraft/aircraft.controller.ts',
      'modules/customers/customers.service.ts',
      'modules/customers/customers.controller.ts',
    ].map((file) => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('\n');
    expect(operational).not.toMatch(/\{\s*tenantId\s*:|AsyncLocalStorage|globalThis|currentTenant|activeTenantSingleton|\bADMIN\b/);
    const app = fs.readFileSync(path.join(sourceRoot, 'app.ts'), 'utf8');
    expect(app).not.toMatch(/app\.use\([^\n]*requireValidActiveTenantContext/);
    const migrations = fs.readdirSync(path.join(root, 'migrations'));
    expect(migrations).toContain('590_add_root_operational_tenant_ownership.ts');
    expect(migrations.some((name) => name.startsWith('597_'))).toBe(false);
    expect(productionFiles().some((file) => /\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(fs.readFileSync(file, 'utf8')))).toBe(false);
  });

  it.each([
    ['local model alias', 'const A = Aircraft; A.findByPk(id);'],
    ['method alias', 'const lookup = Aircraft.findByPk; lookup(id);'],
    ['bound method', 'const lookup = Aircraft.findByPk.bind(Aircraft); lookup(id);'],
    ['destructured method', 'const { findByPk } = Aircraft; findByPk(id);'],
    ['renamed destructuring', 'const { findByPk: lookup } = Aircraft; lookup(id);'],
    ['computed literal', "Aircraft['findByPk'](id);"],
    ['computed constant', "const op = 'findByPk'; Aircraft[op](id);"],
    ['unresolved computed', 'Aircraft[op](id);'],
    ['arrow wrapper', 'const lookup = (id: string) => Aircraft.findByPk(id);'],
    ['function wrapper export', 'function lookup(id: string) { return Aircraft.findByPk(id); } export { lookup };'],
    ['exported arrow wrapper', 'export const lookup = (id: string) => Aircraft.findByPk(id);'],
    ['VERIFY bind export', 'const lookup = Aircraft.findByPk.bind(Aircraft); export { lookup };'],
    ['wrapper re-alias export', 'const load = (id: string) => Aircraft.findByPk(id); const lookup = load; export { lookup };'],
    ['Customer model alias', 'const C = Customer; C.findAll();'],
    ['Aircraft member argument', 'consume(Aircraft.destroy);'],
    ['Customer member argument', 'consume(Customer.update);'],
    ['Aircraft default export', 'export default Aircraft.findByPk;'],
    ['Customer default export', 'export default Customer.update;'],
    ['array member reference', 'const ops = [Aircraft.destroy];'],
    ['object member reference', 'const ops = { lookup: Aircraft.findByPk };'],
    ['returned member reference', 'function lookup() { return Aircraft.findAll; }'],
    ['property assignment reference', 'registry.lookup = Customer.update;'],
    ['callback member reference', 'promise.then(Aircraft.findByPk);'],
    ['aliased model member reference', 'const A = Aircraft; consume(A.destroy);'],
    ['computed member reference', "consume(Aircraft['destroy']);"],
    ['unresolved computed member reference', 'consume(Aircraft[operationName]);'],
    ['direct-model default alias', "import A from '../models/core/Aircraft.js'; consume(A.destroy);"],
    ['direct-model aliased re-export', "export { default as A } from '../models/core/Aircraft.js';"],
    ['Aircraft model default export', 'export default Aircraft;'],
    ['Customer model default export', 'export default Customer;'],
    ['Aircraft model alias default export', 'const A = Aircraft; export default A;'],
    ['Customer model alias default export', 'const C = Customer; export default C;'],
    ['multi-hop model alias default export', 'const A = Aircraft; const B = A; export default B;'],
    ['renamed Aircraft import default export', "import { Aircraft as AircraftModel } from '../models'; export default AircraftModel;"],
    ['renamed Customer import default export', "import { Customer as CustomerModel } from '../models'; export default CustomerModel;"],
    ['parenthesized model default export', 'export default (Aircraft);'],
  ])('rejects synthetic %s bypasses', (_name, body) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.occurrences.length + analysis.issues.length).toBeGreaterThan(0);
  });

  it.each([
    ['Aircraft named export', 'export { Aircraft };'],
    ['Aircraft aliased named export', 'export { Aircraft as DefaultAircraft };'],
    ['Customer named export', 'export { Customer };'],
    ['Customer aliased named export', 'export { Customer as CustomerModel };'],
  ])('rejects synthetic %s model escape', (_name, body) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.issues).not.toEqual([]);
  });

  it.each([
    ['Aircraft function argument', 'consume(Aircraft);'],
    ['Customer function argument', 'consume(Customer);'],
    ['Aircraft return', 'function getModel() { return Aircraft; }'],
    ['Customer return', 'function getModel() { return Customer; }'],
    ['Aircraft array storage', 'const values = [Aircraft];'],
    ['Customer array storage', 'const values = [Customer];'],
    ['Aircraft object storage', 'const registry = { aircraft: Aircraft };'],
    ['Customer object storage', 'const registry = { customer: Customer };'],
    ['Aircraft assignment', 'handler = Aircraft;'],
    ['Customer assignment', 'handler = Customer;'],
    ['Aircraft property assignment', 'registry.model = Aircraft;'],
    ['Customer property assignment', 'registry.model = Customer;'],
    ['Aircraft callback argument', 'registerModel(Aircraft);'],
    ['Customer callback argument', 'registerModel(Customer);'],
    ['Aircraft alias use', 'const M = Aircraft; consume(M);'],
    ['Customer alias use', 'const C = Customer; function getModel() { return C; }'],
    ['multi-hop alias use', 'const A = Aircraft; const B = A; consume(B);'],
    ['conditional model value', 'const model = enabled ? Aircraft : Customer;'],
    ['parenthesized model value', 'consume((Aircraft));'],
    ['non-include model property', 'const registry = { model: Aircraft };'],
  ])('rejects synthetic %s model-object reference', (_name, body) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.issues).not.toEqual([]);
  });

  it.each([
    ['direct import', ''],
    ['renamed import', "import { Aircraft as AircraftModel } from '../models';"],
    ['model alias declaration', 'const A = Aircraft;'],
    ['multi-hop alias declarations', 'const A = Aircraft; const B = A;'],
  ])('allows synthetic %s structural tracking', (_name, body) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis).toEqual({ occurrences: [], issues: [] });
  });

  it.each([
    ['register Aircraft argument', 'register.bind(null, Aircraft);'],
    ['register Customer argument', 'register.bind(null, Customer);'],
    ['callback Aircraft receiver', 'callback.bind(Aircraft);'],
    ['callback Customer receiver', 'callback.bind(Customer);'],
    ['function Aircraft argument', 'someFunction.bind(null, Aircraft);'],
    ['function Customer argument', 'someFunction.bind(null, Customer);'],
    ['Aircraft method Customer receiver', 'Aircraft.findByPk.bind(Customer);'],
    ['Customer method Aircraft receiver', 'Customer.findByPk.bind(Aircraft);'],
    ['Aircraft mutation Customer receiver', 'Aircraft.destroy.bind(Customer);'],
    ['Customer mutation Aircraft receiver', 'Customer.update.bind(Aircraft);'],
    ['Aircraft alias hostile argument', 'const A = Aircraft; register.bind(null, A);'],
    ['Customer alias hostile receiver', 'const C = Customer; callback.bind(C);'],
    ['Aircraft second Customer argument', 'Aircraft.findByPk.bind(Aircraft, Customer);'],
    ['Customer second Aircraft argument', 'Customer.update.bind(Customer, Aircraft);'],
  ])('rejects synthetic hostile bind %s', (_name, body) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.issues).not.toEqual([]);
  });

  it.each([
    ['Aircraft findByPk', 'Aircraft.findByPk.bind(Aircraft);', 'Aircraft', 'reference:findByPk'],
    ['Aircraft destroy', 'Aircraft.destroy.bind(Aircraft);', 'Aircraft', 'reference:destroy'],
    ['Customer findByPk', 'Customer.findByPk.bind(Customer);', 'Customer', 'reference:findByPk'],
    ['Customer update', 'Customer.update.bind(Customer);', 'Customer', 'reference:update'],
    ['Aircraft aliases', 'const A = Aircraft; const B = Aircraft; A.findByPk.bind(B);', 'Aircraft', 'reference:findByPk'],
    ['Customer aliases', 'const C = Customer; const D = Customer; C.update.bind(D);', 'Customer', 'reference:update'],
  ])('allows synthetic matching bind %s exactly once', (_name, body, model, operation) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis).toEqual({
      occurrences: [{ model, identity: `synthetic.ts|module|${operation}` }],
      issues: [],
    });
  });

  const namespaceSource = (body: string) => ts.createSourceFile(
    'synthetic.ts',
    `import * as models from '../models/index.js';\n${body}`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  it.each([
    ['Aircraft argument', 'consume(models.Aircraft);'],
    ['Customer argument', 'consume(models.Customer);'],
    ['Aircraft return', 'function getModel() { return models.Aircraft; }'],
    ['Customer return', 'function getModel() { return models.Customer; }'],
    ['computed Aircraft', "consume(models['Aircraft']);"],
    ['computed Customer', 'consume(models["Customer"]);'],
    ['unresolved computed model', 'consume(models[runtimeName]);'],
    ['Aircraft alias use', 'const A = models.Aircraft; consume(A);'],
    ['Customer alias use', 'const C = models.Customer; function getModel() { return C; }'],
    ['multi-hop Aircraft alias', 'const A = models.Aircraft; const B = A; consume(B);'],
    ['Aircraft default export', 'export default models.Aircraft;'],
    ['Customer default export', 'export default models.Customer;'],
    ['Customer member export', 'export default models.Customer.update;'],
    ['Aircraft member argument', 'consume(models.Aircraft.destroy);'],
    ['hostile Aircraft bind argument', 'register.bind(null, models.Aircraft);'],
    ['cross-model Aircraft bind', 'models.Aircraft.findByPk.bind(models.Customer);'],
    ['cross-model Customer bind', 'models.Customer.update.bind(models.Aircraft);'],
    ['later namespace model bind argument', 'models.Aircraft.findByPk.bind(models.Aircraft, models.Customer);'],
    ['whole namespace argument', 'consume(models);'],
    ['whole namespace return', 'function getModels() { return models; }'],
    ['whole namespace default export', 'export default models;'],
    ['whole namespace named export', 'export { models };'],
    ['destructured Aircraft use', 'const { Aircraft } = models; consume(Aircraft);'],
    ['renamed destructured Customer use', 'const { Customer: C } = models; consume(C);'],
    ['namespace alias Aircraft use', 'const m = models; consume(m.Aircraft);'],
  ])('rejects synthetic namespace escape %s', (_name, body) => {
    const analysis = analyzeSource(namespaceSource(body), path.join(root, 'synthetic.ts'));
    expect(analysis.occurrences.length + analysis.issues.length).toBeGreaterThan(0);
  });

  it('accepts a guarded namespace declaration without runtime use', () => {
    expect(analyzeSource(namespaceSource(''), path.join(root, 'synthetic.ts'))).toEqual({
      occurrences: [],
      issues: [],
    });
  });

  it.each([
    ['Aircraft direct call', 'models.Aircraft.findByPk(id);', 'Aircraft', 'call:findByPk'],
    ['Customer direct call', 'models.Customer.findByPk(id);', 'Customer', 'call:findByPk'],
    ['Aircraft matching bind', 'models.Aircraft.findByPk.bind(models.Aircraft);', 'Aircraft', 'reference:findByPk'],
    ['Customer matching bind', 'models.Customer.update.bind(models.Customer);', 'Customer', 'reference:update'],
  ])('classifies synthetic namespace %s exactly once', (_name, body, model, operation) => {
    expect(analyzeSource(namespaceSource(body), path.join(root, 'synthetic.ts'))).toEqual({
      occurrences: [{ model, identity: `synthetic.ts|module|${operation}` }],
      issues: [],
    });
  });

  it.each([
    ['wrong module', "import * as helpers from './helpers'; helpers.Aircraft;"],
    ['non-root models member', "import * as models from '../models/index.js'; models.Manufacturer;"],
  ])('does not classify synthetic namespace control %s', (_name, body) => {
    const source = ts.createSourceFile('synthetic.ts', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(analyzeSource(source, path.join(root, 'synthetic.ts'))).toEqual({ occurrences: [], issues: [] });
  });

  const relationshipFile = path.join(
    root,
    'src/modules/customers/customer-aircraft-link-tenant.live.ts',
  );
  const relationshipInvocation = (customer: string, aircraft: string, suffix = '') =>
    `new CustomerAircraftLinkTenantRepository(port, customerRepo, aircraftRepo, ${customer}, ${aircraft}${suffix});`;

  it.each([
    ['Aircraft in Customer position', relationshipInvocation('Aircraft', 'Aircraft')],
    ['Customer in Aircraft position', relationshipInvocation('Customer', 'Customer')],
    ['swapped positions', relationshipInvocation('Aircraft', 'Customer')],
    ['duplicate Customer', relationshipInvocation('Customer', 'Customer')],
    ['duplicate Aircraft', relationshipInvocation('Aircraft', 'Aircraft')],
    ['extra Aircraft', relationshipInvocation('Customer', 'Aircraft', ', Aircraft')],
    ['extra Customer', relationshipInvocation('Customer', 'Aircraft', ', Customer')],
    ['Aircraft alias wrong position', `const A = Aircraft; ${relationshipInvocation('A', 'Aircraft')}`],
    ['Customer alias wrong position', `const C = Customer; ${relationshipInvocation('Customer', 'C')}`],
    ['multi-hop Aircraft wrong position', `const A = Aircraft; const B = A; ${relationshipInvocation('B', 'Aircraft')}`],
    ['multi-hop Customer wrong position', `const C = Customer; const D = C; ${relationshipInvocation('Customer', 'D')}`],
    ['different constructor', 'new OtherRelationshipRepository(port, customerRepo, aircraftRepo, Customer, Aircraft);'],
    ['constructor alias', 'const Adapter = CustomerAircraftLinkTenantRepository; new Adapter(port, customerRepo, aircraftRepo, Customer, Aircraft);'],
    ['direct invocation', 'CustomerAircraftLinkTenantRepository(port, customerRepo, aircraftRepo, Customer, Aircraft);'],
  ])('rejects synthetic relationship binding %s', (_name, body) => {
    const source = ts.createSourceFile(
      relationshipFile,
      `import { Aircraft, Customer } from '../../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(analyzeSource(source, relationshipFile).issues).not.toEqual([]);
  });

  it('rejects the approved constructor name outside the exact relationship file', () => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${relationshipInvocation('Customer', 'Aircraft')}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(analyzeSource(source, path.join(root, 'synthetic.ts')).issues).not.toEqual([]);
  });

  it.each([
    ['direct models', relationshipInvocation('Customer', 'Aircraft')],
    ['Customer alias', `const C = Customer; ${relationshipInvocation('C', 'Aircraft')}`],
    ['Aircraft alias', `const A = Aircraft; ${relationshipInvocation('Customer', 'A')}`],
  ])('allows synthetic exact relationship binding with %s', (_name, body) => {
    const source = ts.createSourceFile(
      relationshipFile,
      `import { Aircraft, Customer } from '../../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    expect(analyzeSource(source, relationshipFile)).toEqual({ occurrences: [], issues: [] });
  });

  it.each([
    ['Aircraft direct call', 'Aircraft.findByPk(id);', 'Aircraft', 'call:findByPk'],
    ['Customer direct call', 'Customer.update(values, options);', 'Customer', 'call:update'],
  ])('counts synthetic %s exactly once', (_name, body, model, operation) => {
    const source = ts.createSourceFile(
      'synthetic.ts',
      `import { Aircraft, Customer } from '../models/index.js';\n${body}`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const analysis = analyzeSource(source, path.join(root, 'synthetic.ts'));
    expect(analysis.issues).toEqual([]);
    expect(analysis.occurrences).toEqual([
      { model, identity: `synthetic.ts|module|${operation}` },
    ]);
  });
});
