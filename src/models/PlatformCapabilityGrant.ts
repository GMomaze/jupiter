import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
export class PlatformCapabilityGrant extends Model {}
PlatformCapabilityGrant.init({
  id:{type:DataTypes.UUID,primaryKey:true}, principal_id:{type:DataTypes.UUID,allowNull:false}, capability_id:{type:DataTypes.UUID,allowNull:false},
  granted_by_principal_id:{type:DataTypes.UUID,allowNull:false}, granted_at:{type:DataTypes.DATE,allowNull:false}, grant_reason:{type:DataTypes.TEXT,allowNull:false},
  revoked_by_principal_id:{type:DataTypes.UUID,allowNull:true}, revoked_at:{type:DataTypes.DATE,allowNull:true}, revocation_reason:{type:DataTypes.TEXT,allowNull:true},
},{sequelize,tableName:'platform_capability_grants',timestamps:false});
