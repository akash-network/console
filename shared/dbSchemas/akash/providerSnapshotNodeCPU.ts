import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerSnapshotNodeCPU"
})
export class ProviderSnapshotNodeCPU extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) snapshotNodeId: string;

  @Column vendor: string;
  @Column model: string;
  @Column(DataTypes.SMALLINT) vcores: number;
}
