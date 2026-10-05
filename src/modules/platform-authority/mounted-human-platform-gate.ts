import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PlatformAuthorityRepository } from './platform-authority.repository.js';
import { authorizeSharedOperation, referenceOperationPolicy, type ReferenceMutationOperation, type SharedMutationOperation } from './shared-operation-policy.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

export type MountedSharedRouter = 'LIBRARY' | 'REFERENCE' | 'SERVICE_BULLETINS' | 'SB_SYNC';

type RoutePolicy = Readonly<{ pattern: RegExp; operations: readonly SharedMutationOperation[] }>;
const route = (pattern: RegExp, ...operations: SharedMutationOperation[]): RoutePolicy =>
  Object.freeze({ pattern, operations: Object.freeze(operations) });

export const MOUNTED_HUMAN_MUTATION_POLICY = Object.freeze({
  LIBRARY: Object.freeze([
    route(/^\/life-limit-governance\/proposals$/, 'LIFE_LIMIT_PROPOSE'),
    route(/^\/life-limit-governance\/proposals\/[^/]+\/(replacement|withdrawal)$/, 'LIFE_LIMIT_PROPOSE'),
    route(/^\/life-limit-governance\/proposals\/[^/]+\/(approve|reject)$/, 'LIFE_LIMIT_APPROVE'),
    route(/^\/life-limit-governance\/publications\/[^/]+\/activate$/, 'LIFE_LIMIT_ACTIVATE'),
    route(/^\/ads$/, 'REGULATORY_MASTER_CREATE'),
    route(/^\/sbs$/, 'REGULATORY_MASTER_CREATE'),
    route(/^\/sids$/, 'REGULATORY_MASTER_CREATE'),
    route(/^\/ads\/(applicability-review|service-bulletin-references)\/refresh$/, 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/ads\/applicability-review\/allocations\/[^/]+\/(accept|ignore|restore|link-model|link-manufacturer)$/, 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/sbs\/import-issues\/(recheck-exact-model-codes|expand-safe-shorthand)$/, 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/sbs\/import-issues\/allocations\/[^/]+\/(link-models|ignore)$/, 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/sbs\/import-issues\/allocations\/[^/]+\/create-incomplete-model$/, 'COMPONENT_MODEL_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/(tasks|ads|sbs|models)\/import\/(map|preview)$/, 'SHARED_MASTER_IMPORT'),
    route(/^\/models\/import\/commit$/, 'SHARED_MASTER_IMPORT', 'COMPONENT_MODEL_CREATE'),
    route(/^\/ads\/import\/commit$/, 'SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/sbs\/import\/commit$/, 'SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/tasks\/import\/commit$/, 'SHARED_MASTER_IMPORT', 'MAINTENANCE_MASTER_CREATE'),
    route(/^\/manufacturers$/, 'MANUFACTURER_CREATE'),
    route(/^\/manufacturers\/[^/]+\/update$/, 'MANUFACTURER_UPDATE'),
    route(/^\/asset-types$/, 'REFERENCE_CREATE'),
    route(/^\/model$/, 'COMPONENT_MODEL_CREATE'),
    route(/^\/model\/[^/]+\/update$/, 'COMPONENT_MODEL_UPDATE'),
    route(/^\/requirement$/, 'MAINTENANCE_MASTER_CREATE'),
    route(/^\/requirement\/[^/]+\/update$/, 'MAINTENANCE_MASTER_UPDATE'),
    route(/^\/requirement\/[^/]+\/delete$/, 'MAINTENANCE_MASTER_DELETE'),
    route(/^\/service-bulletin$/, 'REGULATORY_MASTER_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/model\/[^/]+\/(service-bulletins\/attach|airworthiness-directives\/assign|sids\/assign)$/, 'REGULATORY_RELATIONSHIP_MUTATE'),
    route(/^\/model\/[^/]+\/standard-tasks\/assign$/, 'MAINTENANCE_MASTER_UPDATE'),
    route(/^\/model\/[^/]+\/sids\/import$/, 'SHARED_MASTER_IMPORT', 'REGULATORY_RELATIONSHIP_MUTATE', 'REGULATORY_MASTER_CREATE'),
  ]),
  SERVICE_BULLETINS: Object.freeze([route(/^\/$/, 'REGULATORY_MASTER_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE')]),
  SB_SYNC: Object.freeze([route(/^\/sync$/, 'SERVICE_BULLETIN_SYNC')]),
  REFERENCE: Object.freeze([]),
});

function referenceOperation(path: string, method: string): { table: string; operation: ReferenceMutationOperation } | null {
  const create = method === 'POST' ? path.match(/^\/([^/]+)\/gap-create$/) : null;
  if (create?.[1]) return { table: create[1], operation: 'CREATE' };
  const deactivate = method === 'DELETE' ? path.match(/^\/([^/]+)\/[^/]+$/) : null;
  return deactivate?.[1] ? { table: deactivate[1], operation: 'DEACTIVATE' } : null;
}

export function requireMountedHumanPlatformGate(
  repository: PlatformAuthorityRepository,
  mountedRouter: MountedSharedRouter,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' && req.method !== 'DELETE') return next();
    try {
      const reference = mountedRouter === 'REFERENCE' ? referenceOperation(req.path, req.method) : null;
      const operations = reference
        ? null
        : MOUNTED_HUMAN_MUTATION_POLICY[mountedRouter].find(entry => entry.pattern.test(req.path))?.operations;
      if (!reference && !operations) return next();
      const userId = (req.user as { id?: unknown } | undefined)?.id;
      if (typeof userId !== 'string') throw new Error('PLATFORM_AUTHORITY_REQUIRED');
      const authority = await repository.resolveHuman(userId);
      if (!authority || authority.principalType !== 'HUMAN') throw new Error('PLATFORM_AUTHORITY_REQUIRED');
      if (reference) {
        const policy = referenceOperationPolicy(reference.table, reference.operation);
        await repository.authorizeCapability(authority, policy.capability, ['HUMAN']);
      } else {
        for (const operation of operations ?? []) {
          await authorizeSharedOperation(repository, authority, operation);
        }
      }
      (req as Request & { platformAuthority?: unknown }).platformAuthority = authority;
      next();
    } catch (error) {
      emitOperationalEvent({code:'PLATFORM_AUTHORITY_REFUSED',severity:'WARN',outcome:'DENIED',operation:'SHARED_MUTATION',error});
      res.status(403).send('Platform authority required.');
    }
  };
}
