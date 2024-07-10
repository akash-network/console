import { DataTypes } from "sequelize";
import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { ProviderSnapshotNode } from "./providerSnapshotNode";
import { ProviderSnapshotStorage } from "./providerSnapshotStorage";

@Table({
  modelName: "providerSnapshot",
  indexes: [
    { unique: false, fields: ["owner"] },
    { unique: false, fields: ["owner", "checkDate"] },
    { name: "provider_snapshot_id_where_isonline_and_islastofday", unique: false, fields: ["id"], where: { isOnline: true, isLastOfDay: true } },
    { name: "provider_snapshot_id_where_islastsuccessofday", unique: false, fields: ["id"], where: { isLastSuccessOfDay: true } }
  ]
})
export class ProviderSnapshot extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column owner: string;
  @Required @Default(false) @Column isLastOfDay: boolean;
  @Required @Default(false) @Column isLastSuccessOfDay: boolean;

  // Stats
  @Required @Column isOnline: boolean;
  @Required @Column checkDate: Date;
  @Column(DataTypes.TEXT) error?: string;
  @Column deploymentCount?: number;
  @Column leaseCount?: number;
  @Column(DataTypes.BIGINT) activeCPU?: number;
  @Column(DataTypes.BIGINT) activeGPU?: number;
  @Column(DataTypes.BIGINT) activeMemory?: number;
  @Column(DataTypes.BIGINT) activeEphemeralStorage?: number;
  @Column(DataTypes.BIGINT) activePersistentStorage?: number;
  @Column(DataTypes.BIGINT) pendingCPU?: number;
  @Column(DataTypes.BIGINT) pendingGPU?: number;
  @Column(DataTypes.BIGINT) pendingMemory?: number;
  @Column(DataTypes.BIGINT) pendingEphemeralStorage?: number;
  @Column(DataTypes.BIGINT) pendingPersistentStorage?: number;
  @Column(DataTypes.BIGINT) availableCPU?: number;
  @Column(DataTypes.BIGINT) availableGPU?: number;
  @Column(DataTypes.BIGINT) availableMemory?: number;
  @Column(DataTypes.BIGINT) availableEphemeralStorage?: number;
  @Column(DataTypes.BIGINT) availablePersistentStorage?: number;

  @HasMany(() => ProviderSnapshotNode, "snapshotId") nodes: ProviderSnapshotNode[];
  @HasMany(() => ProviderSnapshotStorage, "snapshotId") storage: ProviderSnapshotStorage[];
}
