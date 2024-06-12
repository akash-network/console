import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "validator",
  indexes: [
    { unique: true, fields: ["id"] },
    { unique: true, fields: ["operatorAddress"] },
    { unique: true, fields: ["accountAddress"] },
    { unique: true, fields: ["hexAddress"] }
  ]
})
export class Validator extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column operatorAddress: string;
  @Required @Column accountAddress: string;
  @Required @Column hexAddress: string;
  @Column(DataTypes.UUID) createdMsgId?: string;
  @Required @Column moniker: string;
  @Column identity?: string;
  @Column website?: string;
  @Column(DataTypes.TEXT) description?: string;
  @Column securityContact?: string;
  @Required @Column(DataTypes.DOUBLE) rate: number;
  @Required @Column(DataTypes.DOUBLE) maxRate: number;
  @Required @Column(DataTypes.DOUBLE) maxChangeRate: number;
  @Required @Column(DataTypes.BIGINT) minSelfDelegation: number;

  @Column keybaseUsername?: string;
  @Column keybaseAvatarUrl?: string;
}
