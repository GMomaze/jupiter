/**
 * PATH: src/models/index.ts
 * PURPOSE: Central export barrel + association bootstrap
 */

import sequelize from '../config/database.js';


// Core models
export { AirworthinessDirective } from './AirworthinessDirective.js';
export { AdRelationship } from './AdRelationship.js';
export { AssetType } from './AssetType.js';
export { Manufacturer } from './Manufacturer.js';
export { ComponentModel } from './ComponentModel.js';
export { ServiceBulletin } from './ServiceBulletin.js';
export { ServiceBulletinModel } from './ServiceBulletinModel.js';
export { AircraftSbCompliance } from './AircraftSbCompliance.js';
export { ServiceBulletinSyncRun } from './ServiceBulletinSyncRun.js';
export { CessnaSid } from './cessnaSid.model.js';
export { ModelSid } from './ModelSid.js';
export { SupplementalInspectionDocument } from './SupplementalInspectionDocument.js';
export { SidModelApplicability } from './SidModelApplicability.js';
export { MaintenanceTemplate } from './MaintenanceTemplate.js';
export { MaintenanceTemplateItem } from './MaintenanceTemplateItem.js';
export { PlanningSession } from './PlanningSession.js';
export { Customer } from './Customer.js';
export { CustomerAircraftLink } from './CustomerAircraftLink.js';
export { CustomerUser } from './CustomerUser.js';

export { Aircraft } from './core/Aircraft.js';
export { AircraftCategory } from './core/AircraftCategory.js';
export { AircraftComponent } from './core/AircraftComponent.js';
export { WorkpackStatus } from './core/WorkpackStatus.js';
export { WorkpackType } from './core/WorkpackType.js';
export { Workpack } from './core/Workpack.js';
export { TaskCard } from './core/TaskCard.js';
export { TaskTemplate } from './core/TaskTemplate.js';
export { WorkpackTask } from './core/WorkpackTask.js';
export { WorkpackExecution } from './core/WorkpackExecution.js';
export { WorkpackMeasurement } from './core/WorkpackMeasurement.js';
export { WorkpackSignature } from './core/WorkpackSignature.js';
export { WorkpackSource } from './core/WorkpackSource.js';
export { WorkpackSnag } from './core/WorkpackSnag.js';
export { User } from './core/User.js';

// Audit
export { AuditLog } from './audit/AuditLog.js';
export { WorkpackAuditLog } from './audit/WorkpackAuditLog.js';
export { WorkpackSnagAuditLog } from './audit/WorkpackSnagAuditLog.js';

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
