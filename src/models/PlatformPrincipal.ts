import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
export class PlatformPrincipal extends Model {}
PlatformPrincipal.init({
  id:{type:DataTypes.UUID,primaryKey:true}, principal_type:{type:DataTypes.ENUM('HUMAN','SERVICE'),allowNull:false},
  user_id:{type:DataTypes.UUID,allowNull:true}, service_code:{type:DataTypes.STRING,allowNull:true},
  display_name:{type:DataTypes.STRING,allowNull:false}, status:{type:DataTypes.ENUM('ACTIVE','DISABLED'),allowNull:false},
  created_at:{type:DataTypes.DATE,allowNull:false}, disabled_at:{type:DataTypes.DATE,allowNull:true}, disabled_by_principal_id:{type:DataTypes.UUID,allowNull:true},
},{sequelize,tableName:'platform_principals',timestamps:false});
