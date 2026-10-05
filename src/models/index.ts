/**
 * PATH: src/models/index.ts
 * PURPOSE: Central export barrel + association bootstrap
 */

import sequelize from '../config/database.js';


// Core models
export { AirworthinessDirective } from './AirworthinessDirective.js';
export { AdApplicabilityAllocation } from './AdApplicabilityAllocation.js';
export { AdRelationship } from './AdRelationship.js';
export { AdServiceBulletinReference } from './AdServiceBulletinReference.js';
export { AssetType } from './AssetType.js';
export { Manufacturer } from './Manufacturer.js';
export { ManufacturerSourceName } from './ManufacturerSourceName.js';
export { Tenant } from './Tenant.js';
export type { TenantStatus } from './Tenant.js';
export { TenantMembership } from './TenantMembership.js';
export type { TenantMembershipStatus } from './TenantMembership.js';
export { TenantMembershipRole } from './TenantMembershipRole.js';
export { ComponentModel } from './ComponentModel.js';
export { SerializedComponent } from './SerializedComponent.js';
export { SerializedComponentLifeState } from './SerializedComponentLifeState.js';
export { SerializedComponentMaintenanceEvent } from './SerializedComponentMaintenanceEvent.js';
export { ComponentLifeLimit } from './ComponentLifeLimit.js';
export { ComponentLifeLimitProposal } from './ComponentLifeLimitProposal.js';
export { ComponentLifeLimitPublication } from './ComponentLifeLimitPublication.js';
export { ComponentLifeLimitGovernanceHistory } from './ComponentLifeLimitGovernanceHistory.js';
export { AircraftComponentInstallation } from './AircraftComponentInstallation.js';
export { AircraftComponentMovementHistory } from './AircraftComponentMovementHistory.js';
export { ServiceBulletin } from './ServiceBulletin.js';
export { ServiceBulletinModel } from './ServiceBulletinModel.js';
export { SbModelApplicabilityAllocation } from './SbModelApplicabilityAllocation.js';
export { AircraftSbCompliance } from './AircraftSbCompliance.js';
export { ServiceBulletinSyncRun } from './ServiceBulletinSyncRun.js';
export { ComplianceItem } from './ComplianceItem.js';
export { ComplianceAssignment } from './ComplianceAssignment.js';
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
export { MigrationBatch } from './MigrationBatch.js';
export { MigrationBatchRow } from './MigrationBatchRow.js';
export { MigrationCreatedTarget } from './MigrationCreatedTarget.js';
export { UtilisationEvent } from './UtilisationEvent.js';
export { PlatformPrincipal } from './PlatformPrincipal.js';
export { PlatformCapability } from './PlatformCapability.js';
export { PlatformCapabilityGrant } from './PlatformCapabilityGrant.js';
export { PlatformGlobalAuditLog } from './PlatformGlobalAuditLog.js';

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
