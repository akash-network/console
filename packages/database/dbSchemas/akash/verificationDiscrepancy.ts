import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_discrepancy",
  underscored: true,
  indexes: [{ fields: ["provider", "resolution_status"] }, { fields: ["auditor_a"] }, { fields: ["auditor_b"] }]
})
export class VerificationDiscrepancy extends Model {
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) id!: string;
  @Required @Column provider!: string;
  @Required @Column auditorA!: string;
  @Required @Column auditorATier!: number;
  @Required @Column auditorB!: string;
  @Required @Column auditorBTier!: number;
  @Required @Column(DataTypes.DATE) detectedAt!: Date;
  @Required @Column resolutionStatus!: number;
  @Required @Column(DataTypes.DECIMAL(20, 0)) resolutionProposalId!: string;
  @Required @Column(DataTypes.DECIMAL(20, 0)) graceRecordId!: string;
  @Required @Column resolutionReason!: number;
  @Required @Column faultAttribution!: number;
  @Column(DataTypes.BLOB) resolutionEvidenceHash?: Buffer;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
}
