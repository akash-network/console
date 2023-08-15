import { Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { ProviderAttribute } from "./providerAttribute";
import { ProviderAttributeSignature } from "./providerAttributeSignature";
import { Required } from "../decorators/requiredDecorator";
import { ProviderSnapshot } from "./providerSnapshot";

@Table({
  modelName: "provider",
  indexes: [{ unique: false, fields: ["owner"] }]
})
export class Provider extends Model {
  @Required @PrimaryKey @Column owner: string;
  @Required @Column hostUri: string;
  @Required @Column createdHeight: number;
  @Column deletedHeight?: number;
  @Column email?: string;
  @Column website?: string;
  @Column akashVersion?: string;
  @Column cosmosSdkVersion?: string;

  // Stats
  @Column isOnline?: boolean;
  @Column lastCheckDate?: Date;
  @Column(DataTypes.TEXT) error?: string;
  @Column deploymentCount?: number;
  @Column leaseCount?: number;
  @Column ip?: string;
  @Column ipRegion?: string;
  @Column ipRegionCode?: string;
  @Column ipCountry?: string;
  @Column ipCountryCode?: string;
  @Column ipLat?: string;
  @Column ipLon?: string;
  @Column(DataTypes.BIGINT) activeCPU?: number;
  @Column(DataTypes.BIGINT) activeGPU?: number;
  @Column(DataTypes.BIGINT) activeMemory?: number;
  @Column(DataTypes.BIGINT) activeStorage?: number;
  @Column(DataTypes.BIGINT) pendingCPU?: number;
  @Column(DataTypes.BIGINT) pendingGPU?: number;
  @Column(DataTypes.BIGINT) pendingMemory?: number;
  @Column(DataTypes.BIGINT) pendingStorage?: number;
  @Column(DataTypes.BIGINT) availableCPU?: number;
  @Column(DataTypes.BIGINT) availableGPU?: number;
  @Column(DataTypes.BIGINT) availableMemory?: number;
  @Column(DataTypes.BIGINT) availableStorage?: number;

  @HasMany(() => ProviderAttribute, "provider") providerAttributes: ProviderAttribute[];
  @HasMany(() => ProviderAttributeSignature, "provider") providerAttributeSignatures: ProviderAttributeSignature[];
  @HasMany(() => ProviderSnapshot, "owner") providerSnapshots: ProviderSnapshot[];
}
