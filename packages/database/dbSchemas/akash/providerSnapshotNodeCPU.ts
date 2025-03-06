import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * ProviderSnapshotNodeCPU model for Akash
 *
 * This is used to store the snapshot of a node's CPU at a given time.
 */
@Table({
  modelName: "providerSnapshotNodeCPU",
  indexes: [{ unique: false, fields: ["snapshotNodeId"] }]
})
export class ProviderSnapshotNodeCPU extends Model {
  /**
   * The ID of the snapshot node CPU
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The ID of the snapshot node that this CPU belongs to
   */
  @Required @Column(DataTypes.UUID) snapshotNodeId!: string;

  /**
   * The vendor of the CPU
   * ex: GenuineIntel
   */
  @Column vendor!: string;
  /**
   * The model of the CPU
   * ex: Intel(R) Xeon(R) CPU @ 2.30GHz
   */
  @Column model!: string;
  /**
   * The number of vCPUs the CPU has
   * 1 vCPUs = 1 CPU
   */
  @Column(DataTypes.SMALLINT) vcores!: number;
}
