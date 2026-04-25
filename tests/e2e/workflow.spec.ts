import { test, expect } from '@playwright/test';
import { v4 as uuid } from 'uuid';
import { pool } from '../../src/config/database.js';
import { hashPassword } from '../../src/modules/auth/password.util.js';

const mechanicEmail = 'playwright-mechanic@jupiter.aero';
const mechanicPassword = 'mec123';

async function ensureMechanicUser() {
  const roleResult = await pool.query(
    'SELECT id FROM rf_role WHERE code = $1 LIMIT 1',
    ['MECHANIC']
  );

  const roleId =
    roleResult.rows[0]?.id ??
    (
      await pool.query(
        'INSERT INTO rf_role (id, code, label) VALUES ($1, $2, $3) RETURNING id',
        [uuid(), 'MECHANIC', 'Mechanic']
      )
    ).rows[0].id;

  const passwordHash = await hashPassword(mechanicPassword);

  const userResult = await pool.query(
    `
      INSERT INTO users (id, email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        is_active = true
      RETURNING id
    `,
    [uuid(), mechanicEmail, passwordHash, 'Playwright Mechanic']
  );

  const userId = userResult.rows[0].id;

  await pool.query(
    `
      INSERT INTO user_roles (id, user_id, role_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [uuid(), userId, roleId]
  );
}

test.describe('Authenticated workflow', () => {
  test.beforeAll(async () => {
    await ensureMechanicUser();
  });

  test('mechanic can log in and open the hangar page', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.locator('.login-title')).toHaveText('JUPITER AMMS');

    await page.fill('#email', mechanicEmail);
    await page.fill('#password', mechanicPassword);
    await page.getByRole('button', { name: 'Secure Login' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Jupiter Dashboard' })).toBeVisible();

    await page.goto('/workpacks/hangar');

    await expect(page).toHaveURL(/\/workpacks\/hangar$/);
    await expect(page.getByRole('heading', { name: 'Hangar Floor' })).toBeVisible();
  });
});
