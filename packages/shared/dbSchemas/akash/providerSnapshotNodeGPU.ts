import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerSnapshotNodeGPU",
  indexes: [{ unique: false, fields: ["snapshotNodeId"] }]
})
export class ProviderSnapshotNodeGPU extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) snapshotNodeId: string;

  // Stats
  @Column vendor: string;
  @Column name: string;
  @Column modelId: string;
  @Column interface: string;
  @Column memorySize: string;
}
