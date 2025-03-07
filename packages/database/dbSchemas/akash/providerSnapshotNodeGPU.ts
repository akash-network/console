import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * ProviderSnapshotNodeGPU model for Akash
 *
 * This is used to store the snapshot of a node's GPU at a given time.
 */
@Table({
  modelName: "providerSnapshotNodeGPU",
  indexes: [{ unique: false, fields: ["snapshotNodeId"] }]
})
export class ProviderSnapshotNodeGPU extends Model {
  /**
   * The ID of the snapshot node GPU
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The ID of the snapshot node that this GPU belongs to
   */
  @Required @Column(DataTypes.UUID) snapshotNodeId!: string;

  // Stats
  /**
   * The vendor of the GPU
   * ex: nvidia
   */
  @Column vendor!: string;
  /**
   * The name of the GPU
   * Model name (ex: rtx4090)
   */
  @Column name!: string;
  /**
   * The model ID of the GPU
   * On the provider, this gets mapped to vendor, name, interface and memorySize based on this file https://github.com/akash-network/provider-configs/blob/main/devices/pcie/gpus.json
   */
  @Column modelId!: string;
  /**
   * The interface of the GPU
   * ex: PCIe
   */
  @Column interface!: string;
  /**
   * The memory size of the GPU
   * ex: 24Gi
   */
  @Column memorySize!: string;
}
