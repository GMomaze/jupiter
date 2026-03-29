/**
 * PATH: src/models/index.ts
 * PURPOSE: Central export barrel + association bootstrap
 */

import sequelize from '../config/database.js';

// Core models
export { AssetType } from './AssetType.js';
export { Manufacturer } from './Manufacturer.js';
export { ComponentModel } from './ComponentModel.js';

export { Aircraft } from './core/Aircraft.js';
export { AircraftCategory } from './core/AircraftCategory.js';
export { AircraftComponent } from './core/AircraftComponent.js';
export { WorkpackStatus } from './core/WorkpackStatus.js';
export { Workpack } from './core/Workpack.js';
export { TaskCard } from './core/TaskCard.js';
export { TaskTemplate } from './core/TaskTemplate.js';
export { WorkpackTask } from './core/WorkpackTask.js';
export { User } from './core/User.js';

// Audit
export { AuditLog } from './audit/AuditLog.js';

// Maintenance
export { MaintenanceRequirement } from './MaintenanceRequirement.js';

// RBAC
export { Role } from './rbac/Role.js';
export { Permission } from './rbac/Permission.js';
export { RolePermission } from './rbac/RolePermission.js';
export { UserRole } from './rbac/UserRole.js';

// Load associations
import './associations.js';

export { sequelize };
