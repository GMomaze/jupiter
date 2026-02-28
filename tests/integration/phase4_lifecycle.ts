import { WorkpackService } from '../../modules/workpacks/workpack.service.js';
import { pool } from '../../config/database.js';

async function testLifecycle() {
  console.log('🛫 STARTING PHASE 4 INTEGRATION TEST...');

  try {
    // 1. Setup Test Aircraft (ZS-JUPITER)
    const acResult = await pool.query(
      `UPDATE aircraft SET total_time_hours = 1000.00 WHERE registration = 'ZS-JUPITER' RETURNING id`
    );
    const aircraftId = acResult.rows[0].id;

    // 2. Setup Component (Baseline at 900 hrs, 0 TSO)
    // Actual TSO should be 100.00
    const compResult = await pool.query(`
      UPDATE components 
      SET status = 'INSTALLED', install_hours_airframe = 900.00, tso_at_install = 0.00
      WHERE aircraft_id = $1 LIMIT 1 RETURNING id
    `, [aircraftId]);
    const componentId = compResult.rows[0].id;

    // 3. Create and Link Workpack
    const wp = await WorkpackService.create({ work_order_number: 'TEST-WP-001', aircraft_id: aircraftId });
    
    // Ensure a task exists for this component
    const taskResult = await pool.query(`
      INSERT INTO task_cards (title, status, aircraft_id, component_id)
      VALUES ('500hr Inspection', 'OPEN', $1, $2) RETURNING id
    `, [aircraftId, componentId]);
    const taskId = taskResult.rows[0].id;

    await WorkpackService.addTask(wp.id, taskId);

    // 4. Progress Lifecycle to IN_PROGRESS
    await WorkpackService.issue(wp.id, '00000000-0000-0000-0000-000000000001');
    await WorkpackService.startWork(wp.id, '00000000-0000-0000-0000-000000000001');

    // 5. Sign & Lock Task (Required for Closure)
    await pool.query(`UPDATE task_cards SET status = 'LOCKED' WHERE id = $1`, [taskId]);
    
    // 6. EXECUTE CLOSURE (The Sync Point)
    console.log('🔧 Closing Workpack and Syncing Clocks...');
    await WorkpackService.close(wp.id, '00000000-0000-0000-0000-000000000001');

    // 7. VERIFY RESULTS
    const { rows: finalComp } = await pool.query(
      `SELECT install_hours_airframe, tso_at_install FROM components WHERE id = $1`, 
      [componentId]
    );

    const isHoursSynced = parseFloat(finalComp[0].install_hours_airframe) === 1000.00;
    const isTSOReset = parseFloat(finalComp[0].tso_at_install) === 0.00;

    if (isHoursSynced && isTSOReset) {
      console.log('✅ PHASE 4 TEST PASSED: Component hours synced to 1000.00 and TSO reset.');
    } else {
      console.error('❌ PHASE 4 TEST FAILED: Sync logic mismatch.', finalComp[0]);
    }

  } catch (err) {
    console.error('❌ INTEGRATION ERROR:', err);
  } finally {
    process.exit();
  }
}

testLifecycle();