import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
export class PlatformCapability extends Model {}
PlatformCapability.init({
  id:{type:DataTypes.UUID,primaryKey:true}, code:{type:DataTypes.STRING,allowNull:false,unique:true}, label:{type:DataTypes.STRING,allowNull:false},
  description:DataTypes.TEXT, domain:{type:DataTypes.STRING,allowNull:false}, is_active:{type:DataTypes.BOOLEAN,allowNull:false}, system_locked:{type:DataTypes.BOOLEAN,allowNull:false},
},{sequelize,tableName:'platform_capabilities',timestamps:false});
