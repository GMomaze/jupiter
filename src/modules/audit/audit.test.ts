import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { v4 as uuid } from 'uuid';
import { AuditLog } from '../../models/audit/AuditLog.js';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';

describe('Phase 3.5: Audit Logic Integration Tests', () => {
  let actorId: string;
  let auditLogId: string;
  let rowId: string;

  beforeEach(async () => {
    await assertTestDatabaseSafety(pool);
    actorId = uuid();
    auditLogId = uuid();
    rowId = uuid();
  });

  afterEach(async () => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL app.is_test_mode = 'true'");
      await client.query('DELETE FROM audit_log WHERE id = $1', [auditLogId]);
      await client.query('DELETE FROM users WHERE id = $1', [actorId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  it('should successfully create and retrieve an audit entry', async () => {
    const email = `audit-logic-${actorId}@test.com`;

    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, email, 'test-hash', 'Audit Tester', true]
    );

    await AuditLog.create({
      id: auditLogId,
      table_name: 'aircraft',
      action: 'UPDATE',
      row_id: rowId,
      actor_id: actorId,
      old_values: { status: 'DRAFT' },
      new_values: { status: 'ACTIVE' },
    });

    const foundLog = await AuditLog.findOne({ where: { row_id: rowId } });
    expect(foundLog).toBeDefined();
    expect(foundLog?.action).toBe('UPDATE');
  });
});
