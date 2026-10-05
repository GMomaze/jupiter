# MP2-R3 Open Operational Gap Register

No item below is implemented or closed by documentation. “Before” means the
named gate must refuse progression unless the gap is resolved, explicitly
accepted with a safe alternative, or proven inapplicable by the Project Owner.

| Open gap / decision | Required gate |
| --- | --- |
| `NullStaffInvitationDelivery` provides no invitation token delivery | Before MP2-R5 production activation; include in MP2-R4 rehearsal if staff invitation is an acceptance scenario. |
| Disabled `SB_SYNC_SCHEDULER` recovery is implemented but not formally verified | Pass MP2-R4-2A formal VERIFY, then exercise recovery in MP2-R4. |
| No mounted membership-authority audit view | Before MP2-R4, or approve a bounded non-mounted evidence mechanism for readiness/release verification. |
| No backup/restore orchestration | Before MP2-R4 restore rehearsal, or approve and evidence a precise manual toolchain; production mechanism required before MP2-R5. |
| Production topology/provider not selected | Before MP2-R5; MP2-R4 still requires an approved representative non-production topology. |
| Scheduler-only shutdown | **ACCEPTED / DEFINED:** persistent stop via `SB_SYNC_CRON_ENABLED=false` + application restart; immediate containment via existing graceful application shutdown (`SIGTERM`/`SIGINT`). No scheduler shutdown endpoint introduced. Rehearse the chosen control in MP2-R4. |
| No repository-defined production supervisor command | Before MP2-R5; rehearse the selected non-production supervisor/process control in MP2-R4. |
| Production secret manager not selected | Select and rehearse the representative injection/access controls before MP2-R4; finalize production integration before MP2-R5. |
| Secret rotation/emergency replacement not finalized | Define and rehearse before MP2-R4; production-ready procedure required before MP2-R5. |
| Deployment rollback/forward-repair tooling/process not finalized | Define and rehearse before MP2-R4; production integration required before MP2-R5. |
| Incident tooling and external escalation contacts not finalized | Manual evidence framework may continue through MP2-R4 only if explicitly accepted; production ownership/contact path required before MP2-R5; automation may mature later. |
| Alert thresholds now defined (2J.3); production alert transport/address still deferred | Select the production alert transport/address during production setup (before MP2-R5). |
| Production smoke fixtures and automated residue report absent | Define safe verification data/evidence before MP2-R4; automation may mature later if an approved manual equivalent remains repeatable. |
| RPO | Objective fixed at 1 hour; measure during MP2-R4 recovery rehearsal. This is not a guarantee. |
| RTO | Objective fixed at 4 hours; measure during MP2-R4 recovery rehearsal. This is not a guarantee. |

Post-MP2-R5 operational maturity may improve automation, retention analytics,
incident case management and continuous recovery validation, but it must not be
used to defer any control required to establish safe activation.
