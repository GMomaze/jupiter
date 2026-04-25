# Database (Jupiter)

## workpacks

Columns:

* id (uuid, pk)
* work_order_number (string, unique)
* aircraft_id (uuid)
* status_id (uuid)
* version (int)
* qa_required (boolean)
* certified_by (uuid)
* certified_at (timestamp)
* qa_reviewed_by (uuid)
* qa_reviewed_at (timestamp)
* released_by (uuid)
* released_at (timestamp)

Notes:

* Master record for maintenance event
* Certification, QA, and release are persisted in DB

---

## task_cards

Columns:

* id (uuid, pk)
* task_card_number (string)
* title (string)
* description (text)
* status (string)
* aircraft_id (uuid)
* assigned_to (uuid)
* component_id (uuid)
* work_performed (text)
* signed_by (uuid)
* signed_at (timestamp)
* signature_snapshot_url (text)
* mechanic_completed_by (uuid)
* mechanic_completed_at (timestamp)
* engineer_certified_by (uuid)
* engineer_certified_at (timestamp)
* template_source_id (uuid)
* service_bulletin_id (uuid)
* version (int)

Notes:

* Core task entity
* Stores BOTH:

  * structured state (status, assignments)
  * unstructured data (work_performed)

---

## workpack_tasks

Columns:

* workpack_id (uuid)
* task_id (uuid)

Notes:

* Links tasks to workpacks
* NO aircraft validation at DB level

---

## workpack_executions

Columns:

* id (uuid)
* workpack_id (uuid)
* task_id (uuid)
* attempt_no (int)
* status (string)
* started_by (uuid)
* completed_by (uuid)
* certified_by (uuid)
* started_at (timestamp)
* completed_at (timestamp)
* certified_at (timestamp)
* notes (text)
* failure_reason (text)
* version (int)

Constraints:

* UNIQUE(workpack_id, task_id, attempt_no)

Notes:

* Designed for multiple attempts
* Currently only used for attempt 1
* Execution status does NOT include LOCKED
* LOCKED exists only on task_cards

---

## workpack_measurements

Columns:

* id (uuid)
* execution_id (uuid)
* field_key (string)
* field_label (string)
* position (int)
* value (string)
* created_at (timestamp)
* updated_at (timestamp)

Constraints:

* unique per execution + field

Notes:

* Normalized measurement storage
* Should be source of truth

---

## workpack_signatures

Columns:

* execution_id (uuid)
* role (MECHANIC / ENGINEER)
* signature_type (WORK / REVIEW / APPROVAL)
* user_id (uuid)

Notes:

* Signature tracking per execution

---

## workpack_snags

Columns:

* id (uuid)
* workpack_id (uuid)
* snag_no (int)
* description (text)
* status (OPEN / IN_PROGRESS / RESOLVED / CLOSED)
* assigned_to (uuid)
* reported_by (uuid)
* started_by (uuid)
* resolved_by (uuid)
* closed_by (uuid)
* reported_at (timestamp)
* started_at (timestamp)
* resolved_at (timestamp)
* closed_at (timestamp)
* resolution_notes (text)
* priority (string)
* parts_used (text)
* time_spent_minutes (int)
* version (int)

Notes:

* Strong lifecycle enforcement via DB constraint
* Blocks workpack closure

---

## KEY SYSTEM RISKS

* No enforcement of task ↔ workpack aircraft match
* Execution attempts not implemented despite schema support
* Measurement data duplicated (text + table)
* Execution status does not include LOCKED
* UI and DB not fully aligned
