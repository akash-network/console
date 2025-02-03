import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { AkashBlock } from "./akashBlock";
import { ProviderAttribute } from "./providerAttribute";
import { ProviderAttributeSignature } from "./providerAttributeSignature";
import { ProviderSnapshot } from "./providerSnapshot";

/**
 * Provider model for Akash
 *
 * A Provider on Akash is an entity that offers compute resources to the network.
 * When a deployment is created, the providers automatically bid for the deployment.
 * The deployment owner then has to select which provider bid they want to accept and create a lease with that provider.
 */
@Table({
  modelName: "provider",
  indexes: [{ unique: false, fields: ["owner"] }]
})
export class Provider extends Model {
  /**
   * The owner address of the provider
   */
  @Required @PrimaryKey @Column owner: string;
  /**
   * The hostUri of the provider
   * ex: https://provider.europlots.com:8443
   */
  @Required @Column hostUri: string;
  /**
   * The block height at which the provider was created (MsgCreateProvider)
   */
  @Required @Column createdHeight: number;
  /**
   * The block height at which the provider was updated (MsgUpdateProvider)
   */
  @Column updatedHeight?: number;
  /**
   * The block height at which the provider was deleted (MsgDeleteProvider)
   */
  @Column deletedHeight?: number;
  /**
   * The email of the provider
   */
  @Column email?: string;
  /**
   * The website of the provider
   */
  @Column website?: string;
  /**
   * The Akash version of the provider is running on
   */
  @Column akashVersion?: string;
  /**
   * The Cosmos SDK version of the provider is running on
   */
  @Column cosmosSdkVersion?: string;

  // Stats
  /**
   * The last snapshot id of the provider
   * Snapshots are taken periodically by the indexer to check if the provider is online and to get the provider's stats
   */
  @Column(DataTypes.UUID) lastSnapshotId?: string;
  /**
   * Snapshot ID of the last successful check
   */
  @Column(DataTypes.UUID) lastSuccessfulSnapshotId?: string;
  /**
   * Snapshot ID of the first failed check of the current downtime period. NULL if currently online.
   * It is used to calculate the nextCheckDate
   */
  @Column(DataTypes.UUID) downtimeFirstSnapshotId?: string;
  /**
   * Whether the provider is online
   * This is based on if the provider status endpoint returns a 200 status code
   */
  @Column isOnline?: boolean;
  /**
   * Date & Time of the latest uptime check
   */
  @Column lastCheckDate?: Date;
  /**
   * Planned Date & Time of the next uptime check
   */
  @Required @Default(DataTypes.NOW) @Column nextCheckDate: Date;
  /**
   * Amount of consecutive failed checks, NULL if currently online.
   */
  @Required @Default(0) @Column failedCheckCount: number;
  /**
   * NULL if the latest uptime check was successful, otherwise this will contain the error message.
   */
  @Column(DataTypes.TEXT) error?: string;
  /**
   * IP obtained by resolving DNS for the hostUri
   */
  @Column ip?: string;
  /**
   * The ip region of the provider
   */
  @Column ipRegion?: string;
  /**
   * The ip region code of the provider
   */
  @Column ipRegionCode?: string;
  /**
   * The ip country of the provider
   */
  @Column ipCountry?: string;
  /**
   * The ip country code of the provider
   */
  @Column ipCountryCode?: string;
  /**
   * The ip lat of the provider
   */
  @Column ipLat?: string;
  /**
   * The ip lon of the provider
   */
  @Column ipLon?: string;

  /**
   * The uptime of the provider in the last 1 day
   */
  @Column(DataTypes.DOUBLE) uptime1d?: number;
  /**
   * The uptime of the provider in the last 7 days
   */
  @Column(DataTypes.DOUBLE) uptime7d?: number;
  /**
   * The uptime of the provider in the last 30 days
   */
  @Column(DataTypes.DOUBLE) uptime30d?: number;

  /**
   * The provider attributes associated with the provider
   */
  @HasMany(() => ProviderAttribute, "provider") providerAttributes: ProviderAttribute[];
  /**
   * The provider attribute signatures associated with the provider
   */
  @HasMany(() => ProviderAttributeSignature, "provider") providerAttributeSignatures: ProviderAttributeSignature[];
  /**
   * The provider snapshots associated with the provider
   */
  @HasMany(() => ProviderSnapshot, "owner") providerSnapshots: ProviderSnapshot[];
  /**
   * The block at which the provider was created
   */
  @BelongsTo(() => AkashBlock, "createdHeight") createdBlock: AkashBlock;
  /**
   * The last snapshot of the provider
   */
  @BelongsTo(() => ProviderSnapshot, "lastSnapshotId") lastSnapshot: ProviderSnapshot;
  /**
   * The last successful snapshot of the provider
   */
  @BelongsTo(() => ProviderSnapshot, "lastSuccessfulSnapshotId") lastSuccessfulSnapshot: ProviderSnapshot;
  /**
   * The first snapshot of the provider
   */
  @BelongsTo(() => ProviderSnapshot, "downtimeFirstSnapshotId") downtimeFirstSnapshot: ProviderSnapshot;
}
