import { DataTypes } from "sequelize";
import { BelongsTo, Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle
import { VerificationAuditEscrowCapability } from "./verificationAuditEscrowCapability"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_audit_escrow",
  underscored: true,
  indexes: [{ fields: ["provider", "status"] }, { fields: ["expires_at", "status"] }]
})
export class VerificationAuditEscrow extends Model {
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) id!: string;
  @Required @Column provider!: string;
  @Required @Column consumedByAuditor!: string;
  @Required @Column requestedTier!: number;
  @Required @Column feeDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) feeAmount!: string;
  @Required @Column feeStatus!: number;
  @Required @Column providerDepositDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) providerDepositAmount!: string;
  @Required @Column providerDepositStatus!: number;
  @Required @Column status!: number;
  @Required @Column(DataTypes.DATE) openedAt!: Date;
  @Column(DataTypes.DATE) consumedAt?: Date;
  @Required @Column(DataTypes.DATE) expiresAt!: Date;
  @Column(DataTypes.BLOB) metadataHash?: Buffer;
  @Required @Column settlementReason!: number;
  @Required @Column faultAttribution!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
  @HasMany(() => VerificationAuditEscrowCapability, "auditEscrowId") capabilities!: VerificationAuditEscrowCapability[];
}
