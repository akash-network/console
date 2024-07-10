import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerSnapshotStorage",
  indexes: [{ unique: false, fields: ["snapshotId"] }]
})
export class ProviderSnapshotStorage extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) snapshotId: string;

  @Required @Column class: string;
  @Required @Column(DataTypes.BIGINT) allocatable: number;
  @Required @Column(DataTypes.BIGINT) allocated: number;
}
