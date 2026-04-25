import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

/* planner */

app.get('/workpacks/planner', (req, res) => {
  const aircraft = [
    { id: 1, registration: 'N12345' },
    { id: 2, registration: 'N67890' },
    { id: 3, registration: 'ZS-SWU' }
  ];

  const unassignedTasks = [
    { id: 't1', title: 'Inspect landing gear', aircraft_id: 1 },
    { id: 't2', title: 'Check avionics', aircraft_id: 2 },
    { id: 't3', title: 'Fuel system test', aircraft_id: 1 }
  ];

  const workpacks = [
    {
      id: 1,
      work_order_number: 'WO-1001',
      registration: 'N12345',
      aircraft_id: 1,
      status_code: 'DRAFT',
      tasks: [
        { id: 't1', title: 'Inspect landing gear' }
      ]
    },
    {
      id: 2,
      work_order_number: 'WO-1002',
      registration: 'N67890',
      aircraft_id: 2,
      status_code: 'ISSUED',
      tasks: []
    }
  ];

  res.render('workpacks/planner', { aircraft, unassignedTasks, workpacks });
});

/*index *
app.get('/index', (req, res) => {
  const workpacks = [
    {
      id: 1,
      work_order_number: 'WO-1001',
      registration: 'N12345',
      status_code: 'ISSUED',
      status_label: 'Issued',
      created_at: Date.now()
    },
    {
      id: 2,
      work_order_number: 'WO-1002',
      registration: 'N67890',
      status_code: 'IN_PROGRESS',
      status_label: 'In Progress',
      created_at: Date.now()
    }
  ];

  res.render('workpacks/index', { workpacks });
});

/* */
/* EXECUTION  *
app.get('/execution', (req, res) => {
  const pack = {
    id: 1,
    work_order_number: 'WO-1001',
    registration: 'N12345',
    status_code: 'IN_PROGRESS'
  };

  const tasks = [
  { id: '101abcdef', title: 'Inspect landing gear', description: 'Check hydraulics and struts', status: 'OPEN' },
  { id: '102ghijklm', title: 'Check avionics', description: 'Run diagnostics on navigation systems', status: 'SIGNED' },
  { id: '103nopqrst', title: 'Fuel system test', description: 'Verify fuel lines and pumps', status: 'LOCKED' }
];
  res.render('workpacks/execution', { pack, tasks });
});
/* */
/*  HANGAR
app.get('/hangar', (req, res) => {
  const activePacks = [
    {
      id: 1,
      work_order_number: 'WO-1001',
      registration: 'N12345',
      status_code: 'ISSUED'
    },
    {
      id: 2,
      work_order_number: 'WO-1002',
      registration: 'N67890',
      status_code: 'IN_PROGRESS'
    }
  ];

  res.render('workpacks/hangar', { activePacks });
});

app.get('/hangar', (req, res) => {
  res.render('workpacks/hangar'); // execution.ejs inside src/views/workpacks
});
*/
//app.listen(3000, () => {
//  console.log('Server running at http://localhost:3000');
//});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});