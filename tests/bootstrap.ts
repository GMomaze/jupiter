import { pool } from '../src/config/database.js';

/**
 * Deterministic Test Bootstrap
 * FULL SYSTEM RESET (Structural + RBAC)
 */

export async function resetAndSeedDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    /**
     * ----------------------------------------------------------------
     * 1️⃣ FULL TRUNCATE (INCLUDING RBAC)
     * ----------------------------------------------------------------
     */
    await client.query(`
      TRUNCATE TABLE
        workpack_tasks,
        task_cards,
        aircraft_components,
        workpacks,
        aircraft,
        maintenance_requirements,
        component_models,
        manufacturers,
        rf_asset_type,
        rf_aircraft_category,
        rf_workpack_status,
        rf_role_permissions,
        rf_permission,
        rf_role,
        user_roles,
        audit_log,
        users
      RESTART IDENTITY CASCADE
    `);

    /**
     * ----------------------------------------------------------------
     * 2️⃣ CORE REFERENCE SEED
     * ----------------------------------------------------------------
     */

    const manufacturerResult = await client.query(`
      INSERT INTO manufacturers (code, name)
      VALUES ('JUP', 'Jupiter Aerospace')
      RETURNING id
    `);
    const manufacturerId = manufacturerResult.rows[0].id;

    const assetTypeResult = await client.query(`
      INSERT INTO rf_asset_type (
        code,
        label,
        is_installable_on_aircraft,
        is_required_for_aircraft,
        required_quantity
      )
      VALUES (
        'AIRCRAFT',
        'Aircraft',
        false,
        false,
        0
      )
      RETURNING id
    `);
    const assetTypeId = assetTypeResult.rows[0].id;

    await client.query(`
      INSERT INTO rf_aircraft_category (
        code,
        label,
        description,
        is_active,
        system_locked
      )
      VALUES (
        'FIXED_WING',
        'Fixed Wing',
        'Fixed Wing Aircraft',
        true,
        false
      )
    `);

    await client.query(`
      INSERT INTO rf_workpack_status (
        code,
        label,
        description,
        is_active,
        system_locked
      )
      VALUES
        ('DRAFT', 'Draft', 'Draft Workpack', true, false),
        ('ISSUED', 'Issued', 'Issued Workpack', true, false),
        ('IN_PROGRESS', 'In Progress', 'Work In Progress', true, false),
        ('CLOSED', 'Closed', 'Closed Workpack', true, false)
    `);

    await client.query(
      `
      INSERT INTO component_models (
        model_name,
        manufacturer_id,
        asset_type_id,
        is_active
      )
      VALUES ($1, $2, $3, true)
      `,
      ['JUP-100 Engine', manufacturerId, assetTypeId]
    );

    await client.query(`
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        is_active
      )
      VALUES (
        'test@jupiter.local',
        'test_hash',
        'Test Engineer',
        true
      )
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Global Hook
 */
beforeAll(async () => {
  await resetAndSeedDatabase();
});