import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { VerificationDiscrepancy } from "./verificationDiscrepancy"; // eslint-disable-line import-x/no-cycle
import { VerificationGrace } from "./verificationGrace";

@Table({
  tableName: "verification_grace_discrepancy",
  underscored: true,
  indexes: [{ fields: ["discrepancy_id"] }]
})
export class VerificationGraceDiscrepancy extends Model {
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) graceId!: string;
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) discrepancyId!: string;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => VerificationGrace, "graceId") grace!: VerificationGrace;
  @BelongsTo(() => VerificationDiscrepancy, "discrepancyId") discrepancy!: VerificationDiscrepancy;
}
