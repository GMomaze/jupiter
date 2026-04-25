import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { Role } from '../../models/index.js'; 
import { AuditLog } from '../../models/audit/AuditLog.js';
import { pool } from '../../config/database.js';

describe('Phase 3.5: Audit Logic Integration Tests', () => {

  beforeEach(async () => {
    await pool.query("SET app.is_test_mode = 'true'");
    await pool.query('DELETE FROM audit_log');
    await pool.query("SET app.is_test_mode = 'false'");

    await pool.query('DELETE FROM user_roles');
    await pool.query('DELETE FROM rf_role_permissions');
    await pool.query('DELETE FROM rf_permission');
    await pool.query('DELETE FROM rf_role');
    await pool.query('DELETE FROM users');
  });

  it('should successfully create and retrieve an audit entry', async () => {
    const actorId = uuid();
    const rowId = uuid();

    await Role.findOrCreate({
      where: { code: 'admin' },
      defaults: { id: uuid(), label: 'Administrator' }
    });

    // ✅ FIX
    await pool.query(
      `INSERT INTO users (id, email, password_hash, full_name, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, 'audit@test.com', 'test-hash', 'Audit Tester', true]
    );

    await AuditLog.create({
      id: uuid(),
      table_name: 'aircraft',
      action: 'UPDATE',
      row_id: rowId,
      actor_id: actorId,
      old_values: { status: 'DRAFT' },
      new_values: { status: 'ACTIVE' }
    });

    const foundLog = await AuditLog.findOne({ where: { row_id: rowId } });
    expect(foundLog).toBeDefined();
    expect(foundLog?.action).toBe('UPDATE');
  });
});
