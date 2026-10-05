import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
export class PlatformGlobalAuditLog extends Model {}
PlatformGlobalAuditLog.init({
  id:{type:DataTypes.UUID,primaryKey:true}, principal_id:{type:DataTypes.UUID,allowNull:false}, principal_type:{type:DataTypes.STRING,allowNull:false},
  principal_code:{type:DataTypes.STRING,allowNull:false}, capability_code:{type:DataTypes.STRING,allowNull:false}, action:{type:DataTypes.STRING,allowNull:false},
  resource_type:{type:DataTypes.STRING,allowNull:false}, resource_id:DataTypes.TEXT, correlation_id:{type:DataTypes.UUID,allowNull:false},
  source_provenance:{type:DataTypes.JSONB,allowNull:false}, old_values:DataTypes.JSONB, new_values:DataTypes.JSONB,
  outcome:{type:DataTypes.STRING,allowNull:false}, reason:{type:DataTypes.TEXT,allowNull:false}, created_at:{type:DataTypes.DATE,allowNull:false},
},{sequelize,tableName:'platform_global_audit_log',timestamps:false,hooks:{beforeUpdate(){throw new Error('PLATFORM_GLOBAL_AUDIT_IMMUTABLE');},beforeDestroy(){throw new Error('PLATFORM_GLOBAL_AUDIT_IMMUTABLE');},beforeBulkUpdate(){throw new Error('PLATFORM_GLOBAL_AUDIT_IMMUTABLE');},beforeBulkDestroy(){throw new Error('PLATFORM_GLOBAL_AUDIT_IMMUTABLE');}}});
