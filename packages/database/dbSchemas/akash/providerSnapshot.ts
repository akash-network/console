import { DataTypes } from "sequelize";
import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { ProviderSnapshotNode } from "./providerSnapshotNode";
import { ProviderSnapshotStorage } from "./providerSnapshotStorage";

/**
 * ProviderSnapshot model for Akash
 *
 * This is used to store the snapshot of a provider resources at a given time.
 * It is used to track the provider's stats, such as the amount of CPU, GPU, memory, etc.
 * Active resources are the resources that are currently being used by leases on the provider.
 * Pending resources are the resources that are currently being requested by the provider for leases.
 * Available resources are the resources that are currently available to the provider.
 */
@Table({
  modelName: "providerSnapshot",
  indexes: [
    { unique: false, fields: ["owner"] },
    { unique: false, fields: ["owner", "checkDate"] },
    { name: "provider_snapshot_id_where_isonline_and_islastofday", unique: false, fields: ["id"], where: { isOnline: true, isLastOfDay: true } },
    { name: "provider_snapshot_checkdate_where_islastsuccessofday", unique: false, fields: ["checkDate"], where: { isLastSuccessOfDay: true } }
  ]
})
export class ProviderSnapshot extends Model {
  /**
   * The ID of the snapshot
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The owner address of the provider
   */
  @Required @Column owner!: string;
  /**
   * Whether this is the last snapshot of the day for the associated provider
   */
  @Required @Default(false) @Column isLastOfDay!: boolean;
  /**
   * Whether this is the last successful snapshot of the day for the associated provider
   */
  @Required @Default(false) @Column isLastSuccessOfDay!: boolean;

  // Stats
  /**
   * Whether the provider is online
   */
  @Required @Column isOnline!: boolean;
  /**
   * The date & time of the snapshot
   */
  @Required @Column checkDate!: Date;
  /**
   * null if the uptime check was successful, otherwise this will contain the error message.
   */
  @Column(DataTypes.TEXT) error?: string;
  /**
   * The amount of deployments the provider has
   */
  @Column deploymentCount?: number;
  /**
   * The amount of leases the provider has
   */
  @Column leaseCount?: number;
  /**
   * The amount of active CPU the provider has in thousands of vCPUs
   * 1000 vCPUs = 1 CPU
   */
  @Column(DataTypes.BIGINT) activeCPU?: number;
  /**
   * The amount of active GPU the provider has
   * 1 GPU = 1 GPU
   */
  @Column(DataTypes.BIGINT) activeGPU?: number;
  /**
   * The amount of active memory the provider has in bytes
   */
  @Column(DataTypes.BIGINT) activeMemory?: number;
  /**
   * The amount of active ephemeral storage the provider has in bytes
   */
  @Column(DataTypes.BIGINT) activeEphemeralStorage?: number;
  /**
   * The amount of active persistent storage the provider has in bytes
   */
  @Column(DataTypes.BIGINT) activePersistentStorage?: number;
  /**
   * The amount of pending CPU the provider has in thousands of vCPUs
   */
  @Column(DataTypes.BIGINT) pendingCPU?: number;
  /**
   * The amount of pending GPU the provider has
   */
  @Column(DataTypes.BIGINT) pendingGPU?: number;
  /**
   * The amount of pending memory the provider has in bytes
   */
  @Column(DataTypes.BIGINT) pendingMemory?: number;
  /**
   * The amount of pending ephemeral storage the provider has
   */
  @Column(DataTypes.BIGINT) pendingEphemeralStorage?: number;
  /**
   * The amount of pending persistent storage the provider has in bytes
   */
  @Column(DataTypes.BIGINT) pendingPersistentStorage?: number;
  /**
   * The amount of available CPU the provider has in thousands of vCPUs
   */
  @Column(DataTypes.BIGINT) availableCPU?: number;
  /**
   * The amount of available GPU the provider has
   */
  @Column(DataTypes.BIGINT) availableGPU?: number;
  /**
   * The amount of available GPU the provider has in bytes
   */
  @Column(DataTypes.BIGINT) availableMemory?: number;
  /**
   * The amount of available ephemeral storage the provider has in bytes
   */
  @Column(DataTypes.BIGINT) availableEphemeralStorage?: number;
  /**
   * The amount of available persistent storage the provider has in bytes
   */
  @Column(DataTypes.BIGINT) availablePersistentStorage?: number;

  /**
   * The nodes of the provider at the time of the snapshot
   */
  @HasMany(() => ProviderSnapshotNode, "snapshotId") nodes!: ProviderSnapshotNode[];
  /**
   * The storage of the provider at the time of the snapshot
   */
  @HasMany(() => ProviderSnapshotStorage, "snapshotId") storage!: ProviderSnapshotStorage[];
}
