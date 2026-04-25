# JUPITER AMMS User Manual

Version: 2026-03-29

## 1. Purpose

JUPITER AMMS is an aviation maintenance management system used to manage:

- maintenance library data
- service bulletins
- fleet records
- workpacks and task execution
- role-based operational workflows

This manual is written for day-to-day system users, not developers.

## 2. Logging In

Open the login page and enter your:

- email address
- password

Select `Secure Login` to enter the system.

If login fails:

- confirm your email and password
- confirm your user account is active
- contact an administrator if your access was changed

## 3. Main Navigation

After login, the top navigation bar provides access to:

- `Library`
- `Service Bulletins`
- `Fleet`
- `Workpacks`

The dashboard also provides quick access to:

- Fleet
- Workpacks
- Library

Your visible actions may vary depending on your assigned role and permissions.

## 4. Roles and Access

JUPITER uses role-based access control.

Common roles in the current workflow:

- `PLANNER`
  Creates aircraft, creates draft workpacks, assigns tasks, and issues workpacks.
- `MECHANIC`
  Starts assigned task execution work and records work performed.
- `ENGINEER`
  Works in the hangar and execution areas, certifies tasks, and closes workpacks when all tasks are certified.
- `SUPERVISOR`
  Reviews final quality state and locks tasks for final closure workflow.

Additional permissions may allow access to:

- audit log viewing
- audit export
- library editing

If you can open a page but cannot complete an action, your role may not include the required permission.

## 5. Library Module

Path: `/library`

Use the Library to manage the maintenance reference structure.

The page is organized in a guided sequence:

1. Asset Type
2. OEM
3. Model
4. Rules

### 5.1 Browsing the Library

To browse library data:

1. Select an asset type.
2. Select a manufacturer/OEM.
3. Select a model.
4. Review the associated requirements and service bulletins.

### 5.2 Model Detail

The model detail page shows:

- model name
- manufacturer
- asset type
- maintenance requirements
- service bulletins for that model

### 5.3 Creating or Updating Library Data

Users with `LIBRARY_EDIT` permission can:

- create models
- update models
- create maintenance requirements
- update maintenance requirements
- delete maintenance requirements
- add service bulletins directly to a model

Recommended practice:

- confirm the correct asset type before creating a model
- use clear titles for requirements
- include revision and document links for service bulletins whenever available

## 6. Service Bulletins Module

Path: `/service-bulletins`

The Service Bulletins page is the central register for manual and synced bulletins.

### 6.1 What You Can See

The page displays:

- all loaded service bulletins
- source information
- model information
- last sync time
- sync status
- latest sync totals

### 6.2 Creating a Manual Service Bulletin

Select `Create SB` and enter:

- SB number
- title
- model
- compliance class
- revision, if applicable
- document link, if applicable
- description

Select `Save Service Bulletin` to store it.

Manual entries are marked as manual records in the bulletin list.

### 6.3 Syncing Service Bulletins

The page includes a `Sync SBs` button for manual sync.

The system also supports automatic synchronization in the background. The page now refreshes sync status automatically, so the following fields stay current without a manual page reload:

- `Last Sync Time`
- `Sync Status`

Possible sync states include:

- `IDLE`
- `RUNNING`
- `SUCCESS`
- `FAILED`

If a sync fails, the latest error message is shown on the page.

### 6.4 Reading Sync Results

After a sync, the page shows the latest totals:

- synced count
- created count
- updated count

Use these values to confirm whether new bulletin data was imported.

## 7. Fleet Module

Path: `/aircraft`

The Fleet page lists aircraft with:

- registration
- manufacturer
- model
- serial number
- status

Select an aircraft row to open its detail view.

### 7.1 Adding an Aircraft

Users with planner access can add aircraft from the Fleet page.

Typical aircraft data includes:

- registration
- serial number
- model

### 7.2 Aircraft Detail Tabs

Each aircraft detail page includes:

- `Overview`
- `Service Bulletins`
- `Installed Components`

### 7.3 Installing Components

From the `Overview` tab you can install a component by entering:

- component model
- serial number
- TSN at install
- TSO at install

Select `Finalize Installation` to record the installation.

### 7.4 Aircraft Service Bulletins

From the `Service Bulletins` tab you can review aircraft-applicable bulletins.

Available filters include:

- status
- sort order
- open only
- critical only

Common aircraft bulletin states:

- `OPEN`
- `COMPLIED`
- `NOT_APPLICABLE`

Use the row actions to:

- mark a bulletin complied
- mark a bulletin not applicable
- update compliance state

### 7.5 Installed Components

The `Installed Components` tab shows:

- installed model and manufacturer
- install date
- TSN
- TSO
- quarantine status, when applicable

## 8. Workpacks Module

Path: `/workpacks`

The Workpacks area manages maintenance work orders from planning through execution and close-out.

### 8.1 Workpack Fleet View

The main workpack page shows:

- work order number
- aircraft
- status
- created date

Open `View Detail` to inspect a specific workpack.

### 8.2 Planner Workflow

Path: `/workpacks/planner`

Planner users can:

- create draft workpacks
- add template tasks to draft workpacks
- add unassigned tasks to draft workpacks
- remove tasks from drafts
- issue workpacks
- delete draft workpacks

Recommended planner workflow:

1. Create a draft workpack.
2. Add task templates or available tasks.
3. Review the draft contents carefully.
4. Issue the workpack only when ready for execution.

### 8.3 Hangar Workflow

Path: `/workpacks/hangar`

Engineer and mechanic users can:

- view active workpacks
- move issued workpacks into active work
- open task views
- open the execution cockpit

If a workpack is still `ISSUED`, use `ENTER HANGAR` to move it into execution flow.

### 8.4 Execution Cockpit

Path: `/workpacks/:id/execution`

Engineers and mechanics use this page to work through task execution.

Typical actions include:

- start task work
- complete tasks
- add work notes
- engineer sign-off

Engineers can close a workpack only after every task has been certified.

### 8.5 QA Review

Path: `/workpacks/qa`

Supervisor users review workpacks awaiting final closure.

The QA page shows:

- total tasks
- locked tasks
- close readiness

Use this page to confirm that all required tasks are locked before final closure activity proceeds.

## 9. Audit Log

Path: `/audit`

Users with audit permission can view the system audit log.

The audit log is used to review historical actions and system changes. Depending on your permissions, you may also be able to export audit data.

Use the audit log when you need to:

- investigate record changes
- confirm who performed an action
- support compliance review

## 10. Status Terms

Common statuses you may see in the system:

- Aircraft status: operational lifecycle state of the aircraft
- Workpack status: draft, issued, in progress, and closure-related states
- Task status: execution and certification state of an individual task
- Sync status: current state of service bulletin synchronization

If a status prevents further action, review the previous workflow step first. Most blocked actions are intentional control points in the maintenance process.

## 11. Good Operating Practice

To keep data clean and traceable:

- use consistent naming and numbering
- confirm aircraft, model, and component selections before saving
- add document links and revision data where possible
- do not bypass required workflow stages
- use role-appropriate pages for each action instead of trying to force edits from another screen

For service bulletin management:

- review sync status regularly
- investigate failed sync messages promptly
- use manual creation only when bulletin data is not yet available from sync sources

## 12. Troubleshooting

### 12.1 I cannot access a page

Possible causes:

- you are not logged in
- your session expired
- your role does not allow that page
- your permission set changed

### 12.2 A button or action is missing

Possible causes:

- the action is role-restricted
- the record is in a status that does not allow that action
- the workflow requires a prior step to be completed first

### 12.3 A service bulletin sync failed

Check:

- the `Sync Status` card
- the displayed error message
- whether a previous sync is already running

### 12.4 I cannot close a workpack

Check that:

- the pack is already in progress
- all required tasks were completed
- engineer certification is complete
- QA or lock steps were completed where required

## 13. Support Notes

When reporting a problem, include:

- the page you were on
- the work order number, aircraft registration, or SB number involved
- the action you attempted
- the exact error message shown
- the approximate time of the issue

This makes investigation much faster.
