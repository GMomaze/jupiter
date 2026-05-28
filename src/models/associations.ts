import { AirworthinessDirective } from './AirworthinessDirective.js';
import { AdRelationship } from './AdRelationship.js';
import { AssetType } from './AssetType.js';
import { Manufacturer } from './Manufacturer.js';
import { ComponentModel } from './ComponentModel.js';
import { SerializedComponent } from './SerializedComponent.js';
import { SerializedComponentLifeState } from './SerializedComponentLifeState.js';
import { SerializedComponentMaintenanceEvent } from './SerializedComponentMaintenanceEvent.js';
import { ComponentLifeLimit } from './ComponentLifeLimit.js';
import { AircraftComponentInstallation } from './AircraftComponentInstallation.js';
import { ServiceBulletin } from './ServiceBulletin.js';
import { ServiceBulletinModel } from './ServiceBulletinModel.js';
import { AircraftSbCompliance } from './AircraftSbCompliance.js';
import { ComplianceItem } from './ComplianceItem.js';
import { ComplianceAssignment } from './ComplianceAssignment.js';
import { CessnaSid } from './cessnaSid.model.js';
import { ModelSid } from './ModelSid.js';
import { SupplementalInspectionDocument } from './SupplementalInspectionDocument.js';
import { SidModelApplicability } from './SidModelApplicability.js';
import { MaintenanceTemplate } from './MaintenanceTemplate.js';
import { MaintenanceTemplateItem } from './MaintenanceTemplateItem.js';
import { PlanningSession } from './PlanningSession.js';
import { Customer } from './Customer.js';
import { CustomerAircraftLink } from './CustomerAircraftLink.js';
import { CustomerUser } from './CustomerUser.js';

import { Aircraft } from './core/Aircraft.js';
import { AircraftComponent } from './core/AircraftComponent.js';
import { WorkpackStatus } from './core/WorkpackStatus.js';
import { Workpack } from './core/Workpack.js';
import { TaskCard } from './core/TaskCard.js';
import { TaskTemplate } from './core/TaskTemplate.js';
import { WorkpackTask } from './core/WorkpackTask.js';
import { WorkpackExecution } from './core/WorkpackExecution.js';
import { WorkpackMeasurement } from './core/WorkpackMeasurement.js';
import { WorkpackSignature } from './core/WorkpackSignature.js';
import { WorkpackSource } from './core/WorkpackSource.js';
import { WorkpackSnag } from './core/WorkpackSnag.js';
import { User } from './core/User.js';

import { AuditLog } from './audit/AuditLog.js';
import { WorkpackAuditLog } from './audit/WorkpackAuditLog.js';
import { WorkpackSnagAuditLog } from './audit/WorkpackSnagAuditLog.js';
import { MaintenanceRequirement } from './MaintenanceRequirement.js';

// RBAC
import { Role } from './rbac/Role.js';
import { Permission } from './rbac/Permission.js';
import { RolePermission } from './rbac/RolePermission.js';
import { UserRole } from './rbac/UserRole.js';

/* ============================================================
   CORE DOMAIN ASSOCIATIONS
============================================================ */

AirworthinessDirective.hasMany(AdRelationship, {
  foreignKey: 'ad_id',
  as: 'Relationships',
});
AdRelationship.belongsTo(AirworthinessDirective, {
  foreignKey: 'ad_id',
  as: 'AirworthinessDirective',
});

AssetType.hasMany(ComponentModel, { foreignKey: 'asset_type_id' });
ComponentModel.belongsTo(AssetType, { foreignKey: 'asset_type_id' });

Manufacturer.hasMany(ComponentModel, { foreignKey: 'manufacturer_id' });
ComponentModel.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id' });
ServiceBulletin.belongsToMany(ComponentModel, {
  through: ServiceBulletinModel,
  foreignKey: 'service_bulletin_id',
  otherKey: 'model_id',
  as: 'ApplicableModels',
});
ComponentModel.belongsToMany(ServiceBulletin, {
  through: ServiceBulletinModel,
  foreignKey: 'model_id',
  otherKey: 'service_bulletin_id',
  as: 'ApplicableServiceBulletins',
});
ServiceBulletin.hasMany(TaskCard, { foreignKey: 'service_bulletin_id', as: 'TaskCards' });
TaskCard.belongsTo(ServiceBulletin, { foreignKey: 'service_bulletin_id', as: 'ServiceBulletin' });
ComponentModel.belongsToMany(CessnaSid, {
  through: ModelSid,
  foreignKey: 'model_id',
  otherKey: 'sid_id',
  as: 'Sids',
});
CessnaSid.belongsToMany(ComponentModel, {
  through: ModelSid,
  foreignKey: 'sid_id',
  otherKey: 'model_id',
  as: 'ApplicableModels',
});
SupplementalInspectionDocument.hasMany(SidModelApplicability, {
  foreignKey: 'sid_id',
  as: 'ModelApplicability',
});
SidModelApplicability.belongsTo(SupplementalInspectionDocument, {
  foreignKey: 'sid_id',
  as: 'SupplementalInspectionDocument',
});
ComponentModel.hasMany(SidModelApplicability, {
  foreignKey: 'model_id',
  as: 'SidApplicability',
});
SidModelApplicability.belongsTo(ComponentModel, {
  foreignKey: 'model_id',
  as: 'ComponentModel',
});

Aircraft.belongsTo(ComponentModel, { foreignKey: 'model_id' });
ComponentModel.hasMany(Aircraft, { foreignKey: 'model_id' });
Aircraft.hasMany(AircraftSbCompliance, { foreignKey: 'aircraft_id', as: 'SbCompliance' });
AircraftSbCompliance.belongsTo(Aircraft, { foreignKey: 'aircraft_id', as: 'Aircraft' });
ServiceBulletin.hasMany(AircraftSbCompliance, { foreignKey: 'service_bulletin_id', as: 'AircraftCompliance' });
AircraftSbCompliance.belongsTo(ServiceBulletin, { foreignKey: 'service_bulletin_id', as: 'ServiceBulletin' });
ComplianceItem.hasMany(ComplianceAssignment, {
  foreignKey: 'compliance_item_id',
  as: 'Assignments',
});
ComplianceAssignment.belongsTo(ComplianceItem, {
  foreignKey: 'compliance_item_id',
  as: 'ComplianceItem',
});
ComponentModel.hasMany(ComplianceAssignment, {
  foreignKey: 'model_id',
  as: 'ComplianceAssignments',
});
ComplianceAssignment.belongsTo(ComponentModel, {
  foreignKey: 'model_id',
  as: 'ComponentModel',
});
TaskTemplate.belongsTo(ComponentModel, { foreignKey: 'aircraft_model_id', as: 'AircraftModel' });
TaskTemplate.belongsTo(Aircraft, { foreignKey: 'aircraft_id', as: 'Aircraft' });

Aircraft.hasMany(AircraftComponent, {
  foreignKey: 'aircraft_id',
  as: 'installed_components',
});
AircraftComponent.belongsTo(Aircraft, { foreignKey: 'aircraft_id' });

AircraftComponent.belongsTo(ComponentModel, { foreignKey: 'model_id' });
AircraftComponentInstallation.belongsTo(Aircraft, {
  foreignKey: 'aircraft_id',
  as: 'Aircraft',
});
AircraftComponentInstallation.belongsTo(SerializedComponent, {
  foreignKey: 'serialized_component_id',
  as: 'SerializedComponent',
});
SerializedComponent.hasMany(AircraftComponentInstallation, {
  foreignKey: 'serialized_component_id',
  as: 'Installations',
});
SerializedComponent.belongsTo(ComponentModel, {
  foreignKey: 'component_model_id',
  as: 'ComponentModel',
});
SerializedComponent.hasOne(SerializedComponentLifeState, {
  foreignKey: 'serialized_component_id',
  as: 'LifeState',
});
SerializedComponentMaintenanceEvent.belongsTo(SerializedComponent, {
  foreignKey: 'serialized_component_id',
  as: 'SerializedComponent',
});
SerializedComponent.hasMany(SerializedComponentMaintenanceEvent, {
  foreignKey: 'serialized_component_id',
  as: 'MaintenanceEvents',
});
SerializedComponentMaintenanceEvent.belongsTo(User, {
  foreignKey: 'recorded_by',
  as: 'Recorder',
});
ComponentModel.hasMany(ComponentLifeLimit, {
  foreignKey: 'component_model_id',
  as: 'LifeLimits',
});

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

Workpack.hasMany(WorkpackExecution, { foreignKey: 'workpack_id', as: 'Executions' });
WorkpackExecution.belongsTo(Workpack, { foreignKey: 'workpack_id', as: 'Workpack' });

TaskCard.hasMany(WorkpackExecution, { foreignKey: 'task_id', as: 'Executions' });
WorkpackExecution.belongsTo(TaskCard, { foreignKey: 'task_id', as: 'Task' });

WorkpackExecution.belongsTo(User, { foreignKey: 'started_by', as: 'Starter' });
WorkpackExecution.belongsTo(User, { foreignKey: 'completed_by', as: 'Completer' });
WorkpackExecution.belongsTo(User, { foreignKey: 'certified_by', as: 'Certifier' });

WorkpackExecution.hasMany(WorkpackMeasurement, { foreignKey: 'execution_id', as: 'Measurements' });
WorkpackMeasurement.belongsTo(WorkpackExecution, { foreignKey: 'execution_id', as: 'Execution' });

WorkpackExecution.hasMany(WorkpackSignature, { foreignKey: 'execution_id', as: 'Signatures' });
WorkpackSignature.belongsTo(WorkpackExecution, { foreignKey: 'execution_id', as: 'Execution' });
WorkpackSignature.belongsTo(User, { foreignKey: 'user_id', as: 'Signer' });

WorkpackExecution.hasMany(WorkpackSource, { foreignKey: 'execution_id', as: 'Sources' });
WorkpackSource.belongsTo(WorkpackExecution, { foreignKey: 'execution_id', as: 'Execution' });

WorkpackExecution.hasMany(WorkpackAuditLog, { foreignKey: 'execution_id', as: 'AuditEntries' });
WorkpackAuditLog.belongsTo(WorkpackExecution, { foreignKey: 'execution_id', as: 'Execution' });
WorkpackAuditLog.belongsTo(Workpack, { foreignKey: 'workpack_id', as: 'Workpack' });
WorkpackAuditLog.belongsTo(TaskCard, { foreignKey: 'task_id', as: 'Task' });
WorkpackAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'Actor' });

Workpack.hasMany(WorkpackSnag, { foreignKey: 'workpack_id', as: 'Snags' });
WorkpackSnag.belongsTo(Workpack, { foreignKey: 'workpack_id', as: 'Workpack' });
WorkpackSnag.belongsTo(AircraftComponent, { foreignKey: 'component_id', as: 'Component' });
WorkpackSnag.belongsTo(User, { foreignKey: 'created_by', as: 'Reporter' });
WorkpackSnag.belongsTo(User, { foreignKey: 'assigned_to', as: 'Assignee' });
WorkpackSnag.belongsTo(User, { foreignKey: 'started_by', as: 'Starter' });
WorkpackSnag.belongsTo(User, { foreignKey: 'resolved_by', as: 'Resolver' });
WorkpackSnag.belongsTo(User, { foreignKey: 'closed_by', as: 'Closer' });

WorkpackSnag.hasMany(WorkpackSnagAuditLog, { foreignKey: 'snag_id', as: 'AuditEntries' });
WorkpackSnagAuditLog.belongsTo(WorkpackSnag, { foreignKey: 'snag_id', as: 'Snag' });
WorkpackSnagAuditLog.belongsTo(Workpack, { foreignKey: 'workpack_id', as: 'Workpack' });
WorkpackSnagAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'Actor' });

AuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
User.hasMany(AuditLog, { foreignKey: 'actor_id' });

ComponentModel.hasMany(MaintenanceRequirement, { foreignKey: 'model_id' });
MaintenanceRequirement.belongsTo(ComponentModel, { foreignKey: 'model_id' });
ComponentModel.hasMany(MaintenanceTemplate, {
  foreignKey: 'model_id',
  as: 'MaintenanceTemplates',
});
MaintenanceTemplate.belongsTo(ComponentModel, {
  foreignKey: 'model_id',
  as: 'ComponentModel',
});
MaintenanceTemplate.hasMany(MaintenanceTemplateItem, {
  foreignKey: 'template_id',
  as: 'Items',
});
MaintenanceTemplateItem.belongsTo(MaintenanceTemplate, {
  foreignKey: 'template_id',
  as: 'Template',
});
PlanningSession.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'Owner',
});
PlanningSession.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'Creator',
});
PlanningSession.belongsTo(User, {
  foreignKey: 'finalized_by',
  as: 'Finalizer',
});
PlanningSession.belongsTo(Aircraft, {
  foreignKey: 'aircraft_id',
  as: 'Aircraft',
});
PlanningSession.belongsTo(MaintenanceTemplate, {
  foreignKey: 'template_id',
  as: 'Template',
});
PlanningSession.belongsTo(Workpack, {
  foreignKey: 'generated_workpack_id',
  as: 'GeneratedWorkpack',
});
PlanningSession.hasMany(Workpack, {
  foreignKey: 'planning_session_id',
  as: 'GeneratedWorkpacks',
});
Workpack.belongsTo(PlanningSession, {
  foreignKey: 'planning_session_id',
  as: 'PlanningSession',
});
Customer.hasMany(CustomerAircraftLink, {
  foreignKey: 'customer_id',
  as: 'AircraftLinks',
});
CustomerAircraftLink.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'Customer',
});
Aircraft.hasMany(CustomerAircraftLink, {
  foreignKey: 'aircraft_id',
  as: 'CustomerLinks',
});
CustomerAircraftLink.belongsTo(Aircraft, {
  foreignKey: 'aircraft_id',
  as: 'Aircraft',
});
Customer.hasMany(CustomerUser, {
  foreignKey: 'customer_id',
  as: 'Users',
});
CustomerUser.belongsTo(Customer, {
  foreignKey: 'customer_id',
  as: 'Customer',
});

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
