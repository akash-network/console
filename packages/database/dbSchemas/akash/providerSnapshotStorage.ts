import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * ProviderSnapshotStorage model for Akash
 *
 * This is used to store the snapshot of a provider's storage at a given time.
 */
@Table({
  modelName: "providerSnapshotStorage",
  indexes: [{ unique: false, fields: ["snapshotId"] }]
})
export class ProviderSnapshotStorage extends Model {
  /**
   * The database ID of the snapshot storage
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The ID of the snapshot that this storage belongs to
   */
  @Required @Column(DataTypes.UUID) snapshotId!: string;

  /**
   * The class of the storage
   * ex: hdd, ssd, nvme
   */
  @Required @Column class!: string;
  /**
   * The amount of allocatable storage the provider has in bytes
   */
  @Required @Column(DataTypes.BIGINT) allocatable!: number;
  /**
   * The amount of allocated storage the provider has in bytes
   */
  @Required @Column(DataTypes.BIGINT) allocated!: number;
}
