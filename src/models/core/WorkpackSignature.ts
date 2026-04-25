import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackSignature extends Model {
  declare id: string;
  declare execution_id: string;
  declare role: string;
  declare signature_type: string;
  declare user_id: string;
  declare signed_at: Date;
}

WorkpackSignature.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    execution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    signature_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'APPROVAL',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    signed_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'workpack_signatures',
    underscored: true,
    timestamps: false,
  }
);
