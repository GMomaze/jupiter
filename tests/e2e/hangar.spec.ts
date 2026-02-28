import { test, expect } from '@playwright/test';
import { pool } from '../../src/config/database.js';

let aircraftId: string;

test.beforeEach(async () => {
  console.log('GGGG - beforeEach');

  // Fetch a real aircraft ID ONCE
  const aircraftResult = await pool.query(`
    SELECT id FROM aircraft ORDER BY id LIMIT 1
  `);

  if (aircraftResult.rows.length === 0) {
    throw new Error('E2E setup failed: no aircraft found');
  }

  aircraftId = aircraftResult.rows[0].id;

  // Seed one unassigned task FOR THIS AIRCRAFT
  await pool.query(
    `
    INSERT INTO task_cards (title, description, status, aircraft_id)
    VALUES ($1, $2, $3, $4)
    `,
    ['E2E Task', 'Seeded for hangar E2E test', 'OPEN', aircraftId]
  );
});

test('engineer can start work from hangar', async ({ page }) => {
  // 1. Planner
  console.log('GGGG - 1. Planner');
  await page.goto('http://127.0.0.1:2000/workpacks/planner');

  // 2. Create draft workpack
  console.log('GGGG - 2. Create draft workpack');
  const workOrderNumber = 'E2E-HANGAR-001';

  await page.fill('input[name="work_order_number"]', workOrderNumber);

  // CRITICAL: select the SAME aircraft used in beforeEach
  await page.selectOption('select[name="aircraft_id"]', {
    value: aircraftId,
  });

  await page.getByRole('button', { name: /create draft workpack/i }).click();

  // Planner is server-rendered → reload required
  console.log('GGGG - 2.1 Reload planner to reflect new draft');
  await page.waitForLoadState('networkidle');
  await page.reload();

  // 3. Assign first task to the draft pack
  console.log('GGGG - 3. Assign first task to the draft pack');

  const assignDropdown = page
    .locator('select:has-text("Assign to Draft Pack")')
    .first();

  await expect(
    assignDropdown.locator('option', { hasText: workOrderNumber })
  ).toHaveCount(1);

  await assignDropdown.selectOption({ label: workOrderNumber });

  // 4. Issue workpack
  console.log('GGGG - 4. Issue workpack');

  const issueBtn = page.getByRole('button', { name: /issue workpack/i });
  await expect(issueBtn).toBeVisible();
  await issueBtn.click();

  // 5. Go to hangar
  console.log('GGGG - 5. Go to hangar');
  await page.goto('http://127.0.0.1:2000/workpacks/hangar');

  // 6. Start work
  console.log('GGGG - 6. Start work');

  const startBtn = page.getByRole('button', { name: /start work/i });
  await expect(startBtn).toBeVisible();
  await startBtn.click();

  // 7. Verify lifecycle
  console.log('GGGG - 7. Verify lifecycle');
  await expect(page.getByText('IN_PROGRESS')).toBeVisible();
});
