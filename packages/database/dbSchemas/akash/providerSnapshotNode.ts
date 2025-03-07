import { DataTypes } from "sequelize";
import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { ProviderSnapshotNodeCPU } from "./providerSnapshotNodeCPU";
import { ProviderSnapshotNodeGPU } from "./providerSnapshotNodeGPU";

/**
 * ProviderSnapshotNode model for Akash
 *
 * This is used to store the snapshot of a node at a given time.
 */
@Table({
  modelName: "providerSnapshotNode",
  indexes: [{ unique: false, fields: ["snapshotId"] }]
})
export class ProviderSnapshotNode extends Model {
  /**
   * The ID of the snapshot node
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The ID of the database snapshot that this node belongs to
   */
  @Required @Column(DataTypes.UUID) snapshotId!: string;

  // Stats
  /**
   * The name of the node
   */
  @Column name!: string;
  /**
   * The amount of allocatable CPU the node has in thousands of vCPUs
   * 1000 vCPUs = 1 CPU
   */
  @Column(DataTypes.BIGINT) cpuAllocatable!: number;
  /**
   * The amount of allocated CPU the node has in thousands of vCPUs
   */
  @Column(DataTypes.BIGINT) cpuAllocated!: number;
  /**
   * The amount of allocatable memory the node has in bytes
   */
  @Column(DataTypes.BIGINT) memoryAllocatable!: number;
  /**
   * The amount of allocated memory the node has in bytes
   */
  @Column(DataTypes.BIGINT) memoryAllocated!: number;
  /**
   * The amount of allocatable ephemeral storage the node has in bytes
   */
  @Column(DataTypes.BIGINT) ephemeralStorageAllocatable!: number;
  /**
   * The amount of allocated ephemeral storage the node has in bytes
   */
  @Column(DataTypes.BIGINT) ephemeralStorageAllocated!: number;
  /**
   * Whether the node has HDD storage capabilities
   */
  @Column capabilitiesStorageHDD!: boolean;
  /**
   * Whether the node has SSD storage capabilities
   */
  @Column capabilitiesStorageSSD!: boolean;
  /**
   * Whether the node has NVMe storage capabilities
   */
  @Column capabilitiesStorageNVME!: boolean;
  /**
   * The amount of allocatable GPU the node has
   */
  @Column(DataTypes.BIGINT) gpuAllocatable!: number;
  /**
   * The amount of allocated GPU the node has
   */
  @Column(DataTypes.BIGINT) gpuAllocated!: number;

  /**
   * The GPUs of the node
   */
  @HasMany(() => ProviderSnapshotNodeGPU, "snapshotNodeId") gpus!: ProviderSnapshotNodeGPU[];
  /**
   * The CPUs of the node
   */
  @HasMany(() => ProviderSnapshotNodeCPU, "snapshotNodeId") cpus!: ProviderSnapshotNodeCPU[];
}
