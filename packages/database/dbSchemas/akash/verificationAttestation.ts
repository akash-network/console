import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle
import { VerificationAuditor } from "./verificationAuditor"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_attestation",
  underscored: true,
  indexes: [{ fields: ["provider", "status", "tier"] }, { fields: ["expires_at", "status"] }, { fields: ["audit_escrow_id"] }]
})
export class VerificationAttestation extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @PrimaryKey @Column auditor!: string;
  @Required @Column tier!: number;
  @Required @Column(DataTypes.BLOB) evidenceHash!: Buffer;
  @Required @Column feeDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) feeAmount!: string;
  @Required @Column feeStatus!: number;
  @Required @Column(DataTypes.DATE) createdAt!: Date;
  @Required @Column(DataTypes.DATE) expiresAt!: Date;
  @Required @Column status!: number;
  @Required @Column voidedReason!: number;
  @Required @Column depositDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) depositAmount!: string;
  @Required @Column depositStatus!: number;
  @Required @Column(DataTypes.DECIMAL(20, 0)) auditEscrowId!: string;
  @Required @Column faultAttribution!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
  @BelongsTo(() => VerificationAuditor, { foreignKey: "auditor", targetKey: "address", constraints: false }) auditorRecord!: VerificationAuditor;
}
