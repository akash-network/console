import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_provider_snapshot",
  underscored: true,
  indexes: [{ fields: ["compliance_deadline", "suspended"] }, { fields: ["snapshot_timestamp"] }]
})
export class VerificationProviderSnapshot extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @Column(DataTypes.BLOB) snapshotHash!: Buffer;
  @Required @Column totalGpus!: number;
  @Required @Column totalVcpus!: number;
  @Required @Column(DataTypes.DECIMAL(20, 0)) totalMemoryMb!: string;
  @Required @Column(DataTypes.DECIMAL(20, 0)) totalStorageMb!: string;
  @Required @Column activeLeases!: number;
  @Required @Column softwareVersion!: string;
  @Column(DataTypes.BLOB) softwareSignature?: Buffer;
  @Column softwareIdentityVersion?: string;
  @Column softwareArtifactRef?: string;
  @Column softwareDigestAlgorithm?: string;
  @Column(DataTypes.BLOB) softwareDigest?: Buffer;
  @Column softwareSignatureType?: string;
  @Column(DataTypes.BLOB) softwareIdentitySignature?: Buffer;
  @Column softwareSignatureRef?: string;
  @Column softwarePublicKeyRef?: string;
  @Required @Column(DataTypes.DATE) postedAt!: Date;
  @Required @Column(DataTypes.DATE) snapshotTimestamp!: Date;
  @Required @Column(DataTypes.DATE) complianceDeadline!: Date;
  @Required @Column suspended!: boolean;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
}
