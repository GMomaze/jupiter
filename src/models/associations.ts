import { AssetType } from './AssetType.js';
import { Manufacturer } from './Manufacturer.js';
import { ComponentModel } from './ComponentModel.js';

import { Aircraft } from './core/Aircraft.js';
import { AircraftComponent } from './core/AircraftComponent.js';
import { WorkpackStatus } from './core/WorkpackStatus.js';
import { Workpack } from './core/Workpack.js';
import { TaskCard } from './core/TaskCard.js';
import { TaskTemplate } from './core/TaskTemplate.js';
import { WorkpackTask } from './core/WorkpackTask.js';
import { User } from './core/User.js';

import { AuditLog } from './audit/AuditLog.js';
import { MaintenanceRequirement } from './MaintenanceRequirement.js';

// RBAC
import { Role } from './rbac/Role.js';
import { Permission } from './rbac/Permission.js';
import { RolePermission } from './rbac/RolePermission.js';
import { UserRole } from './rbac/UserRole.js';

/* ============================================================
   CORE DOMAIN ASSOCIATIONS
============================================================ */

AssetType.hasMany(ComponentModel, { foreignKey: 'asset_type_id' });
ComponentModel.belongsTo(AssetType, { foreignKey: 'asset_type_id' });

Manufacturer.hasMany(ComponentModel, { foreignKey: 'manufacturer_id' });
ComponentModel.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id' });

Aircraft.belongsTo(ComponentModel, { foreignKey: 'model_id' });
ComponentModel.hasMany(Aircraft, { foreignKey: 'model_id' });
TaskTemplate.belongsTo(ComponentModel, { foreignKey: 'aircraft_model_id', as: 'AircraftModel' });
TaskTemplate.belongsTo(Aircraft, { foreignKey: 'aircraft_id', as: 'Aircraft' });

Aircraft.hasMany(AircraftComponent, {
  foreignKey: 'aircraft_id',
  as: 'installed_components',
});
AircraftComponent.belongsTo(Aircraft, { foreignKey: 'aircraft_id' });

AircraftComponent.belongsTo(ComponentModel, { foreignKey: 'model_id' });

Workpack.belongsTo(Aircraft, { foreignKey: 'aircraft_id' });
Aircraft.hasMany(Workpack, { foreignKey: 'aircraft_id' });

Workpack.belongsTo(WorkpackStatus, { foreignKey: 'status_id' });

Workpack.belongsToMany(TaskCard, {
  through: WorkpackTask,
  foreignKey: 'workpack_id',
  otherKey: 'task_id',
});
TaskCard.belongsToMany(Workpack, {
  through: WorkpackTask,
  foreignKey: 'task_id',
  otherKey: 'workpack_id',
});
TaskCard.belongsTo(User, { foreignKey: 'assigned_to', as: 'Assignee' });
User.hasMany(TaskCard, { foreignKey: 'assigned_to', as: 'AssignedTasks' });
TaskCard.belongsTo(User, { foreignKey: 'mechanic_completed_by', as: 'MechanicCompleter' });
TaskCard.belongsTo(User, { foreignKey: 'engineer_certified_by', as: 'EngineerCertifier' });

AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
User.hasMany(AuditLog, { foreignKey: 'actor_id' });

ComponentModel.hasMany(MaintenanceRequirement, { foreignKey: 'model_id' });
MaintenanceRequirement.belongsTo(ComponentModel, { foreignKey: 'model_id' });

/* ============================================================
   RBAC ASSOCIATIONS (CRITICAL FIX)
============================================================ */

// User <-> Role (Many-to-Many)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'user_id',
  otherKey: 'role_id',
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'role_id',
  otherKey: 'user_id',
});

// Role <-> Permission (Many-to-Many)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: 'role_id',
  otherKey: 'permission_id',
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: 'permission_id',
  otherKey: 'role_id',
});
