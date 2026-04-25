C:.
|   .dependency-cruiser.js
|   .env
|   .env.example
|   .gitignore
|   .nvmrc
|   fix_migration.ts
|   force_table.ts
|   Gemini  Checkpoint.odt
|   jupiter.code-workspace
|   knexfile.js
|   knexfile.ts
|   migrate.js
|   migrate.ts
|   package-lock.json
|   package.json
|   playwright.config.ts
|   project-structure2.txt
|   project1.dna.txt
|   project_structure.txt
|   project_tree.txt
|   server.js
|   tsconfig.json
|   vitest.config.ts
|   
+---.github
|   \---workflow
|           ci.yml
|           
+---ADocument
|       05 Feb 2026 state.odt
|       code 11-02-2026.odt
|       current DNA.odt
|       Jupeter DNA.odt
|       Jupiter build 2.odt
|       Jupiter planning 1.odt
|       Jupiter planning 2.odt
|       Uphase 8 status report.odt
|       
+---migrations
|       001__create_reference_tables.ts
|       002__initial_references.ts
|       003__create_all_rf_tables.ts
|       004__create_identity_schema.ts
|       005__create_aircraft_table.ts
|       007__create_task_cards_table.ts
|       008_create_workpacks.ts
|       009_expand_aircraft_and_components.sql
|       
|               
+---seeds
|       01_reference_seeds.ts
|       02_identity_seeds.ts
|       03_seed_references.ts
|       04_seed_workpack_statuses.ts
|       05_aircraft_seed.ts
|       
+---src
|   |   app.ts
|   |   server.ts
|   |   
|   +---config
|   |       database.ts
|   |       
|   +---modules
|   |   +---aircraft
|   |   |       aircraft-component.service.ts
|   |   |       aircraft.controller.ts
|   |   |       aircraft.model.ts
|   |   |       aircraft.routes.ts
|   |   |       aircraft.service.ts
|   |   |       aircraft_component.model.ts
|   |   |       
|   |   +---assets
|   |   |       asset.controller.ts
|   |   |       asset.service.ts
|   |   |       
|   |   +---audit
|   |   |       audit.routes.ts
|   |   |       audit.service.ts
|   |   |       audit.test.ts
|   |   |       audit_ui.test.ts
|   |   |       
|   |   +---auth
|   |   |       ability.ts
|   |   |       auth.config.ts
|   |   |       auth.routes.ts
|   |   |       auth.test.ts
|   |   |       passport.config.ts
|   |   |       password.util.ts
|   |   |       staff.routes.ts
|   |   |       UserService.ts
|   |   |       
|   |   +---components
|   |   |       component.controller.ts
|   |   |       component.routes.ts
|   |   |       component.service.ts
|   |   |       
|   |   +---inventory
|   |   |       inventory.controller.ts
|   |   |       inventory.routes.ts
|   |   |       inventory.service.ts
|   |   |       
|   |   +---library
|   |   |       library.controller.ts
|   |   |       library.routes.ts
|   |   |       library.service.ts
|   |   |       
|   |   +---projection
|   |   |       projection.controller.ts
|   |   |       projection.routes.ts
|   |   |       
|   |   +---reference
|   |   |       BaseReferenceService.ts
|   |   |       reference.config.ts
|   |   |       reference.controller.ts
|   |   |       reference.policy.ts
|   |   |       reference.routes.ts
|   |   |       reference.test.ts
|   |   |       reference.types.ts
|   |   |       
|   |   +---tasks
|   |   |       snapshot.service.ts
|   |   |       task.controller.ts
|   |   |       task.routes.ts
|   |   |       task.service.ts
|   |   |       
|   |   \---workpacks
|   |           index.ejs
|   |           pdf.service.ts
|   |           workpack.controller.ts
|   |           workpack.routes.ts
|   |           workpack.service.ts
|   |           
|   +---public
|   |       style.css
|   |       
|   +---routes
|   |       index.ts
|   |       
|   +---services
|   |       snapshot.service.ts
|   |       
|   \---views
|       |   layout.ejs
|       |   
|       +---aircraft
|       |       view.ejs
|       |       
|       +---audit
|       |       index.ejs
|       |       
|       +---auth
|       |       ability.ts
|       |       login.ejs
|       |       staff-list.ejs
|       |       
|       +---components
|       |       create.ejs
|       |       
|       +---library
|       |   |   dashboard.ejs
|       |   |   
|       |   \---partials
|       |           manufacturer_form.ejs
|       |           manufacturer_list.ejs
|       |           model_edit_form.ejs
|       |           model_form.ejs
|       |           model_list.ejs
|       |           requirement_edit_form.ejs
|       |           requirement_form.ejs
|       |           requirement_list.ejs
|       |           
|       +---modules
|       |   +---aircraft
|       |   |   |   create.ejs
|       |   |   |   details.ejs
|       |   |   |   
|       |   |   \---partials
|       |   |           status-card.ejs
|       |   |           
|       |   \---projection
|       |           fleet-status.ejs
|       |           fleet_health.ejs
|       |           
|       +---partials
|       |       audit-rows.ejs
|       |       component_actions.ejs
|       |       footer.ejs
|       |       header.ejs
|       |       install-component-modal.ejs
|       |       install_modal.ejs
|       |       reference-edit-modal.ejs
|       |       reference-list.ejs
|       |       reference-table-body.ejs
|       |       rf-options.ejs
|       |       rf-select-container.ejs
|       |       task_row.ejs
|       |       
|       +---reference
|       |       gap-modal.ejs
|       |       list.ejs
|       |       
|       \---workpacks
|               details.ejs
|               execution.ejs
|               hangar.ejs
|               index.ejs
|               list.html
|               planner.ejs
|               qa.ejs
|               tasks.ejs
|               
+---storage
|   \---snapshots
|           CRS-10d4e460-f108-49ef-af59-15f1b19300fe-1770485237248.pdf
|           CRS-585860e3-27f3-4985-93ff-afb3c49e7c63-1770481690601.pdf
|           
+---test-results
|   |   .last-run.json
|   |   
|   \---hangar-engineer-can-start-work-from-hangar
|           error-context.md
|           
\---tests
    |   aircraft_lifecycle.test.ts
    |   component_lifecycle.test.ts
    |   maintenance_integrity.test.ts
    |   task_immutability.test.ts
    |   
    +---e2e
    |       hangar.spec.ts
    |       planner.spec.ts
    |       
    +---integration
    |       phase4_lifecycle.ts
    |       workpack_integrity.test.ts
    |       
    \---unit
            aircraft.test.ts
            