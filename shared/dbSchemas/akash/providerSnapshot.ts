import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerSnapshot",
  indexes: [
    { unique: false, fields: ["owner"] },
    { unique: false, fields: ["owner", "checkDate"] },
    { unique: false, fields: ["isOnline", "isLastOfDay"] }
  ]
})
export class ProviderSnapshot extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column owner: string;
  @Required @Default(false) @Column isLastOfDay: boolean;

  // Stats
  @Column isOnline?: boolean;
  @Column checkDate?: Date;
  @Column(DataTypes.TEXT) error?: string;
  @Column deploymentCount?: number;
  @Column leaseCount?: number;
  @Column(DataTypes.BIGINT) activeCPU?: number;
  @Column(DataTypes.BIGINT) activeGPU?: number;
  @Column(DataTypes.BIGINT) activeMemory?: number;
  @Column(DataTypes.BIGINT) activeStorage?: number;
  @Column(DataTypes.BIGINT) pendingCPU?: number;
  @Column(DataTypes.BIGINT) pendingGPU?: number;
  @Column(DataTypes.BIGINT) pendingMemory?: number;
  @Column(DataTypes.BIGINT) pendingStorage?: number;
  @Column(DataTypes.BIGINT) availableCPU?: number;
  @Column(DataTypes.BIGINT) availableGPU?: number;
  @Column(DataTypes.BIGINT) availableMemory?: number;
  @Column(DataTypes.BIGINT) availableStorage?: number;
}
