import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { VerificationAuditEscrow } from "./verificationAuditEscrow"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_audit_escrow_capability",
  underscored: true,
  indexes: [{ fields: ["capability"] }]
})
export class VerificationAuditEscrowCapability extends Model {
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) auditEscrowId!: string;
  @Required @PrimaryKey @Column capability!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => VerificationAuditEscrow, "auditEscrowId") auditEscrow!: VerificationAuditEscrow;
}
