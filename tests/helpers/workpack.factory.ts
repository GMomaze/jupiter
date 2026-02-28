import { pool } from '../../src/config/database.js';
import { v4 as uuid } from 'uuid';

export async function createWorkpackStatus(code: string) {
  const id = uuid();

  await pool.query(
    `
    INSERT INTO rf_workpack_status (id, code, label, is_active)
    VALUES ($1, $2, $2, true)
    `,
    [id, code]
  );

  return { id, code };
}