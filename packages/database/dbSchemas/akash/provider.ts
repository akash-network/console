import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { ProviderAttribute } from "./providerAttribute";
import { ProviderAttributeSignature } from "./providerAttributeSignature";
import { ProviderSnapshot } from "./providerSnapshot";
import { AkashBlock } from "./akashBlock";

@Table({
  modelName: "provider",
  indexes: [{ unique: false, fields: ["owner"] }]
})
export class Provider extends Model {
  @Required @PrimaryKey @Column owner: string;
  @Required @Column hostUri: string;
  @Required @Column createdHeight: number;
  @Column updatedHeight?: number;
  @Column deletedHeight?: number;
  @Column email?: string;
  @Column website?: string;
  @Column akashVersion?: string;
  @Column cosmosSdkVersion?: string;

  // Stats
  @Column(DataTypes.UUID) lastSnapshotId?: string;
  @Column(DataTypes.UUID) lastSuccessfulSnapshotId?: string;
  @Column(DataTypes.UUID) downtimeFirstSnapshotId?: string;
  @Column isOnline?: boolean;
  @Column lastCheckDate?: Date;
  @Required @Default(DataTypes.NOW) @Column nextCheckDate: Date;
  @Required @Default(0) @Column failedCheckCount: number;
  @Column(DataTypes.TEXT) error?: string;
  @Column ip?: string;
  @Column ipRegion?: string;
  @Column ipRegionCode?: string;
  @Column ipCountry?: string;
  @Column ipCountryCode?: string;
  @Column ipLat?: string;
  @Column ipLon?: string;

  @Column(DataTypes.DOUBLE) uptime1d?: number;
  @Column(DataTypes.DOUBLE) uptime7d?: number;
  @Column(DataTypes.DOUBLE) uptime30d?: number;

  @HasMany(() => ProviderAttribute, "provider") providerAttributes: ProviderAttribute[];
  @HasMany(() => ProviderAttributeSignature, "provider") providerAttributeSignatures: ProviderAttributeSignature[];
  @HasMany(() => ProviderSnapshot, "owner") providerSnapshots: ProviderSnapshot[];
  @BelongsTo(() => AkashBlock, "createdHeight") createdBlock: AkashBlock;
  @BelongsTo(() => ProviderSnapshot, "lastSnapshotId") lastSnapshot: ProviderSnapshot;
  @BelongsTo(() => ProviderSnapshot, "lastSuccessfulSnapshotId") lastSuccessfulSnapshot: ProviderSnapshot;
  @BelongsTo(() => ProviderSnapshot, "downtimeFirstSnapshotId") downtimeFirstSnapshot: ProviderSnapshot;
}
