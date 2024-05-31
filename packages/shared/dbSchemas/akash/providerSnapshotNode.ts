import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Required } from "../decorators/requiredDecorator";
import { ProviderSnapshotNodeGPU } from "./providerSnapshotNodeGPU";
import { ProviderSnapshotNodeCPU } from "./providerSnapshotNodeCPU";

@Table({
  modelName: "providerSnapshotNode",
  indexes: [{ unique: false, fields: ["snapshotId"] }]
})
export class ProviderSnapshotNode extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) snapshotId: string;

  // Stats
  @Column name: string;
  @Column(DataTypes.BIGINT) cpuAllocatable: number;
  @Column(DataTypes.BIGINT) cpuAllocated: number;

  @Column(DataTypes.BIGINT) memoryAllocatable: number;
  @Column(DataTypes.BIGINT) memoryAllocated: number;

  @Column(DataTypes.BIGINT) ephemeralStorageAllocatable: number;
  @Column(DataTypes.BIGINT) ephemeralStorageAllocated: number;

  @Column capabilitiesStorageHDD: boolean;
  @Column capabilitiesStorageSSD: boolean;
  @Column capabilitiesStorageNVME: boolean;

  @Column(DataTypes.BIGINT) gpuAllocatable: number;
  @Column(DataTypes.BIGINT) gpuAllocated: number;

  @HasMany(() => ProviderSnapshotNodeGPU, "snapshotNodeId") gpus: ProviderSnapshotNodeGPU[];
  @HasMany(() => ProviderSnapshotNodeCPU, "snapshotNodeId") cpus: ProviderSnapshotNodeCPU[];
}
