import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import type { Pool, PoolClient } from 'pg';
import type { Request } from 'express';
import sequelize from '../../config/database.js';
import type { PlatformAuthority } from './platform-authority.js';
import { assertRepositoryIssuedPlatformAuthority } from './platform-authority.repository.js';
import { platformMutationOperationPolicy, type PlatformMutationOperation } from './platform-mutation-operation-policy.js';

const TARGET_TENANT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Authoritative target-tenant validation for platform-authorized tenant-context
// installation. This is NOT a general "set any tenant" facility: the tenant UUID
// must already have been established by the authorized platform operation
// (generated internally during provisioning, or resolved from the database under
// a platform capability), never taken from untrusted request input.
export function assertAuthoritativeTargetTenant(tenantId: unknown): asserts tenantId is string {
  if (typeof tenantId !== 'string' || !TARGET_TENANT_UUID.test(tenantId)) {
    throw new Error('PLATFORM_TARGET_TENANT_INVALID');
  }
}

export type PlatformMutationEvidence = Readonly<{
  authority: PlatformAuthority;
  operations: readonly PlatformMutationOperation[];
  reason: string;
  correlationId: string;
  source: Readonly<Record<string, unknown>>;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
}>;

export type PlatformMutationAuditCapture = Readonly<{
  setBefore(value: unknown): void;
}>;

export function platformMutationEvidence(
  authority: unknown,
  operations: readonly PlatformMutationOperation[],
  input: Omit<PlatformMutationEvidence, 'authority' | 'operations'>,
): PlatformMutationEvidence {
  assertRepositoryIssuedPlatformAuthority(authority);
  if (authority.principalType !== 'HUMAN') throw new Error('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
  if (!operations.length || !input.reason.trim() || !input.correlationId.trim() || !input.resourceType.trim()) {
    throw new Error('PLATFORM_MUTATION_EVIDENCE_REQUIRED');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.correlationId)) {
    throw new Error('PLATFORM_MUTATION_CORRELATION_INVALID');
  }
  return Object.freeze({ ...input, authority, operations: Object.freeze([...operations]), source: Object.freeze({ ...input.source }) });
}

export function platformServiceMutationEvidence(
  authority: unknown,
  operations: readonly PlatformMutationOperation[],
  input: Omit<PlatformMutationEvidence, 'authority' | 'operations'>,
): PlatformMutationEvidence {
  assertRepositoryIssuedPlatformAuthority(authority);
  if (authority.principalType !== 'SERVICE') throw new Error('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
  if (!operations.length || operations.some(operation => !platformMutationOperationPolicy(operation).principalTypes.includes('SERVICE'))) {
    throw new Error('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
  }
  if (!input.reason.trim() || !input.correlationId.trim() || !input.resourceType.trim()) throw new Error('PLATFORM_MUTATION_EVIDENCE_REQUIRED');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.correlationId)) throw new Error('PLATFORM_MUTATION_CORRELATION_INVALID');
  return Object.freeze({ ...input, authority, operations: Object.freeze([...operations]), source: Object.freeze({ ...input.source }) });
}

export function requestPlatformMutationEvidence(
  req: Request,
  operations: readonly PlatformMutationOperation[],
  resourceType: string,
  resourceId?: string | null,
): PlatformMutationEvidence {
  return platformMutationEvidence(req.platformAuthority, operations, {
    reason: typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim()
      : `Authorized ${req.method} ${req.baseUrl}${req.path}`,
    correlationId: typeof req.headers['x-correlation-id'] === 'string'
      ? req.headers['x-correlation-id']
      : randomUUID(),
    source: { kind: 'MOUNTED_HUMAN_REQUEST', method: req.method, path: `${req.baseUrl}${req.path}` },
    resourceType,
    ...(resourceId === undefined ? {} : { resourceId }),
  });
}

export function requirePlatformMutationOperations(
  evidence: PlatformMutationEvidence,
  expected: readonly PlatformMutationOperation[],
): PlatformMutationEvidence {
  assertRepositoryIssuedPlatformAuthority(evidence?.authority);
  if (evidence.operations.length !== expected.length || expected.some(operation => !evidence.operations.includes(operation))) {
    throw new Error('PLATFORM_MUTATION_OPERATION_MISMATCH');
  }
  return evidence;
}

async function revalidate(transaction: Transaction, evidence: PlatformMutationEvidence) {
  assertRepositoryIssuedPlatformAuthority(evidence.authority);
  const principalType = evidence.authority.principalType;
  for (const operation of evidence.operations) {
    const policy = platformMutationOperationPolicy(operation);
    if (!policy.principalTypes.includes(principalType)) throw new Error('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
    const [rows] = await sequelize.query(
      `SELECT 1 FROM platform_principals pp
       JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL
       JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true
       WHERE pp.id=:principalId AND pp.principal_type=:principalType AND pp.status='ACTIVE' AND pc.code=:capability`,
      { replacements: { principalId: evidence.authority.principalId, principalType, capability: policy.capability }, transaction },
    );
    if (!(rows as unknown[]).length) throw new Error('PLATFORM_CAPABILITY_REQUIRED');
  }
}

async function revalidatePg(client: PoolClient, evidence: PlatformMutationEvidence) {
  assertRepositoryIssuedPlatformAuthority(evidence.authority);
  const principalType = evidence.authority.principalType;
  for (const operation of evidence.operations) {
    const policy = platformMutationOperationPolicy(operation);
    if (!policy.principalTypes.includes(principalType)) throw new Error('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
    const result = await client.query(
      `SELECT 1 FROM platform_principals pp
       JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL
       JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true
       WHERE pp.id=$1 AND pp.principal_type=$2 AND pp.status='ACTIVE' AND pc.code=$3`,
      [evidence.authority.principalId, principalType, policy.capability],
    );
    if (!result.rowCount) throw new Error('PLATFORM_CAPABILITY_REQUIRED');
  }
}

export async function executeAuthoritativePlatformMutation<T>(
  evidence: PlatformMutationEvidence,
  work: (transaction: Transaction, audit: PlatformMutationAuditCapture) => Promise<T>,
  describe: (result: T) => Readonly<{ resourceId?: string | null; after?: unknown }> = () => ({}),
  suppliedTransaction?: Transaction,
): Promise<T> {
  const run = async (transaction: Transaction) => {
    await revalidate(transaction, evidence);
    let before = evidence.before;
    const audit = Object.freeze({ setBefore(value: unknown) { before = value; } });
    const result = await work(transaction, audit);
    const description = describe(result);
    for (const operation of evidence.operations) {
      const policy = platformMutationOperationPolicy(operation);
      await sequelize.query(
        `INSERT INTO platform_global_audit_log
          (id,principal_id,principal_type,principal_code,capability_code,action,resource_type,resource_id,correlation_id,source_provenance,old_values,new_values,outcome,reason)
         VALUES (:id,:principalId,:principalType,:principalCode,:capability,:action,:resourceType,:resourceId,:correlationId,:source::jsonb,:oldValues::jsonb,:newValues::jsonb,'SUCCESS',:reason)`,
        { replacements: {
          id: randomUUID(), principalId: evidence.authority.principalId,
          principalType: evidence.authority.principalType,
          principalCode: evidence.authority.principalCode, capability: policy.capability,
          action: operation, resourceType: evidence.resourceType,
          resourceId: description.resourceId ?? evidence.resourceId ?? null,
          correlationId: evidence.correlationId, source: JSON.stringify(evidence.source),
          oldValues: before == null ? null : JSON.stringify(before),
          newValues: description.after == null ? null : JSON.stringify(description.after),
          reason: evidence.reason,
        }, transaction },
      );
    }
    return result;
  };
  return suppliedTransaction ? run(suppliedTransaction) : sequelize.transaction(run);
}

export async function executeAuthoritativePgPlatformMutation<T>(
  pool: Pool,
  evidence: PlatformMutationEvidence,
  work: (client: PoolClient, audit: PlatformMutationAuditCapture) => Promise<T>,
  describe: (result: T) => Readonly<{ resourceId?: string | null; after?: unknown }> = () => ({}),
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await revalidatePg(client, evidence);
    let before = evidence.before;
    const audit = Object.freeze({ setBefore(value: unknown) { before = value; } });
    const result = await work(client, audit);
    const description = describe(result);
    for (const operation of evidence.operations) {
      const policy = platformMutationOperationPolicy(operation);
      await client.query(
        `INSERT INTO platform_global_audit_log
          (id,principal_id,principal_type,principal_code,capability_code,action,resource_type,resource_id,correlation_id,source_provenance,old_values,new_values,outcome,reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,'SUCCESS',$13)`,
        [randomUUID(), evidence.authority.principalId, evidence.authority.principalType, evidence.authority.principalCode,
          policy.capability, operation, evidence.resourceType,
          description.resourceId ?? evidence.resourceId ?? null, evidence.correlationId,
          JSON.stringify(evidence.source), before == null ? null : JSON.stringify(before),
          description.after == null ? null : JSON.stringify(description.after), evidence.reason],
      );
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
