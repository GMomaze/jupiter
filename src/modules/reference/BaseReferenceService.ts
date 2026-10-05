// Rule 0.2: Path adjustment for deeper nesting
import { pool } from '../../config/database.js'; 
import { ReferenceRecord } from './reference.types.js';
import { AppAbility, Subjects } from '../auth/ability.js';
import type { PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { executeAuthoritativePgPlatformMutation, requirePlatformMutationOperations } from '../platform-authority/authoritative-platform-mutation.js';
import { referenceOperationPolicy, type ReferenceMutationOperation, type SharedMutationOperation } from '../platform-authority/shared-operation-policy.js';

export class BaseReferenceService {
  constructor(private tableName: string) {}

  private evidence(evidence: PlatformMutationEvidence, operation: ReferenceMutationOperation) {
    const policy = referenceOperationPolicy(this.tableName, operation);
    const expected: SharedMutationOperation = policy.capability === 'RBAC_DEFINITION_MANAGE'
      ? 'RBAC_DEFINITION_MANAGE'
      : `REFERENCE_${operation}` as SharedMutationOperation;
    return requirePlatformMutationOperations(evidence, [expected]);
  }

  /**
   * 1.1 & 1.3: Get all active records
   */
  async getAllActive(): Promise<ReferenceRecord[]> {
    const { rows } = await pool.query(
      `SELECT * FROM ${this.tableName} WHERE is_active = true ORDER BY label ASC`,
    );
    return rows;
  }

  /**
   * 1.4, 1.6 & 1.7 & 2.3: Create Reference
   * Rule: CASL enforced
   */
  async create(evidence: PlatformMutationEvidence, data: { code: string; label: string; description?: string }, ability?: AppAbility): Promise<ReferenceRecord> {
    // 2.3: Service enforces abilities
    if (ability && ability.cannot('create', this.tableName as Subjects)) {
      throw new Error(`UNAUTHORIZED: Cannot create entries in ${this.tableName}`);
    }

    const normalizedCode = data.code.trim().toUpperCase();

    try {
      return executeAuthoritativePgPlatformMutation(pool, this.evidence(evidence, 'CREATE'), async client => {
      const result = await client.query(
        `INSERT INTO ${this.tableName} (code, label, description, system_locked, is_active) 
         VALUES ($1, $2, $3, false, true) 
         RETURNING *`,
        [normalizedCode, data.label, data.description],
      );
      return result.rows[0];
      }, row => ({ resourceId: row.id, after: row }));
    } catch (err: any) {
      if (err.code === '23505') {
        throw new Error(`REJECTED: The code "${normalizedCode}" already exists in ${this.tableName}.`);
      }
      throw err;
    }
  }

  /**
   * 1.4 & 1.5: Update Reference
   */
  async update(evidence: PlatformMutationEvidence, id: string, updates: { label?: string; description?: string }): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.label) {
      fields.push(`label = $${fields.length + 1}`);
      values.push(updates.label);
    }
    if (updates.description) {
      fields.push(`description = $${fields.length + 1}`);
      values.push(updates.description);
    }

    if (fields.length === 0) return;

    values.push(id);
    let after: unknown;
    await executeAuthoritativePgPlatformMutation(pool, this.evidence(evidence, 'UPDATE'), async (client, audit) => {
      const current = await client.query(`SELECT * FROM ${this.tableName} WHERE id = $1 FOR UPDATE`, [id]);
      if (!current.rows[0]) throw new Error('REFERENCE_RECORD_NOT_FOUND');
      audit.setBefore(current.rows[0]);
      const updated = await client.query(
        `UPDATE ${this.tableName} SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`, values,
      );
      after = updated.rows[0];
    }, () => ({ resourceId: id, after }));
  }

  /**
   * 1.4 & 2.3: Soft-delete only
   * Rule: system_locked rows cannot be deactivated
   * Rule: CASL enforced
   */
  async deactivate(evidence: PlatformMutationEvidence, id: string, ability?: AppAbility): Promise<void> {
    // 2.3: Service enforces abilities
    if (ability && ability.cannot('deactivate', this.tableName as Subjects)) {
      throw new Error(`UNAUTHORIZED: Cannot deactivate entries in ${this.tableName}`);
    }

    let after: unknown;
    await executeAuthoritativePgPlatformMutation(pool, this.evidence(evidence, 'DEACTIVATE'), async (client, audit) => {
    const current = await client.query(`SELECT * FROM ${this.tableName} WHERE id = $1 FOR UPDATE`, [id]);
    if (!current.rows[0]) throw new Error('ACTION PROHIBITED: This record is system-locked or does not exist.');
    audit.setBefore(current.rows[0]);
    const result = await client.query(
      `UPDATE ${this.tableName} 
       SET is_active = false 
       WHERE id = $1 AND system_locked = false RETURNING *`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new Error('ACTION PROHIBITED: This record is system-locked or does not exist.');
    }
    after = result.rows[0];
    }, () => ({ resourceId: id, after }));
  }
}
