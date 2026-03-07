import type { Knex } from "knex";
import argon2 from "argon2";

export async function seed(knex: Knex): Promise<void> {

  console.log("🌱 Seeding RBAC users, roles and permissions...");

  /**
   * Passwords
   */
  const adminPass = await argon2.hash("admin");
  const engineerPass = await argon2.hash("eng");
  const mechanicPass = await argon2.hash("mec");
  const plannerPass = await argon2.hash("pln");
  const viewerPass = await argon2.hash("vwr");

  /**
   * ROLES
   */
  await knex("rf_role")
    .insert([
      { code: "ADMIN", label: "System Administrator", description: "Full system access" },
      { code: "ENGINEER", label: "Maintenance Engineer" },
      { code: "MECHANIC", label: "Technician / Mechanic" },
      { code: "PLANNER", label: "Maintenance Planner" },
      { code: "VIEWER", label: "Read Only User" }
    ])
    .onConflict("code")
    .ignore();

  /**
   * PERMISSIONS
   */
  await knex("rf_permission")
    .insert([
      {
        code: "LIBRARY_VIEW",
        label: "View Maintenance Library",
        module: "LIBRARY"
      },
      {
        code: "LIBRARY_EDIT",
        label: "Edit Maintenance Library",
        module: "LIBRARY"
      },
      {
        code: "AIRCRAFT_VIEW",
        label: "View Aircraft",
        module: "AIRCRAFT"
      },
      {
        code: "AIRCRAFT_EDIT",
        label: "Edit Aircraft",
        module: "AIRCRAFT"
      },
      {
        code: "WORKPACK_VIEW",
        label: "View Workpacks",
        module: "WORKPACK"
      },
      {
        code: "WORKPACK_EDIT",
        label: "Edit Workpacks",
        module: "WORKPACK"
      },
      {
        code: "INVENTORY_VIEW",
        label: "View Inventory",
        module: "INVENTORY"
      },
      {
        code: "INVENTORY_EDIT",
        label: "Edit Inventory",
        module: "INVENTORY"
      }
    ])
    .onConflict("code")
    .ignore();

  /**
   * FETCH ROLES
   */
  const adminRole = await knex("rf_role").where({ code: "ADMIN" }).first();
  const engineerRole = await knex("rf_role").where({ code: "ENGINEER" }).first();
  const mechanicRole = await knex("rf_role").where({ code: "MECHANIC" }).first();
  const plannerRole = await knex("rf_role").where({ code: "PLANNER" }).first();
  const viewerRole = await knex("rf_role").where({ code: "VIEWER" }).first();

  /**
   * FETCH PERMISSIONS
   */
  const libraryView = await knex("rf_permission").where({ code: "LIBRARY_VIEW" }).first();
  const libraryEdit = await knex("rf_permission").where({ code: "LIBRARY_EDIT" }).first();

  /**
   * ROLE → PERMISSION MAPPING
   */
  await knex("rf_role_permissions")
    .insert([
      { role_id: adminRole.id, permission_id: libraryView.id },
      { role_id: adminRole.id, permission_id: libraryEdit.id },

      { role_id: engineerRole.id, permission_id: libraryView.id },
      { role_id: engineerRole.id, permission_id: libraryEdit.id },

      { role_id: mechanicRole.id, permission_id: libraryView.id },

      { role_id: plannerRole.id, permission_id: libraryView.id },

      { role_id: viewerRole.id, permission_id: libraryView.id }
    ])
    .onConflict(["role_id", "permission_id"])
    .ignore();

  /**
   * USERS
   */
  await knex("users")
    .insert([
      {
        email: "admin@jupiter.local",
        password_hash: adminPass,
        full_name: "System Administrator"
      },
      {
        email: "engineer@jupiter.local",
        password_hash: engineerPass,
        full_name: "Maintenance Engineer"
      },
      {
        email: "mechanic@jupiter.local",
        password_hash: mechanicPass,
        full_name: "Mechanic Technician"
      },
      {
        email: "planner@jupiter.local",
        password_hash: plannerPass,
        full_name: "Maintenance Planner"
      },
      {
        email: "viewer@jupiter.local",
        password_hash: viewerPass,
        full_name: "Library Viewer"
      }
    ])
    .onConflict("email")
    .ignore();

  /**
   * FETCH USERS
   */
  const adminUser = await knex("users").where({ email: "admin@jupiter.local" }).first();
  const engineerUser = await knex("users").where({ email: "engineer@jupiter.local" }).first();
  const mechanicUser = await knex("users").where({ email: "mechanic@jupiter.local" }).first();
  const plannerUser = await knex("users").where({ email: "planner@jupiter.local" }).first();
  const viewerUser = await knex("users").where({ email: "viewer@jupiter.local" }).first();

  /**
   * USER → ROLE MAPPING
   */
  await knex("user_roles")
    .insert([
      { user_id: adminUser.id, role_id: adminRole.id },
      { user_id: engineerUser.id, role_id: engineerRole.id },
      { user_id: mechanicUser.id, role_id: mechanicRole.id },
      { user_id: plannerUser.id, role_id: plannerRole.id },
      { user_id: viewerUser.id, role_id: viewerRole.id }
    ])
    .onConflict(["user_id", "role_id"])
    .ignore();

  console.log("✅ RBAC seed complete");

}