import { DataTypes } from "sequelize";
import { BelongsTo, Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle
import { VerificationGraceDiscrepancy } from "./verificationGraceDiscrepancy"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_grace",
  underscored: true,
  indexes: [{ fields: ["provider", "status"] }, { fields: ["expires_at", "status"] }]
})
export class VerificationGrace extends Model {
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) id!: string;
  @Required @Column provider!: string;
  @Required @Column preservedTier!: number;
  @Required @Column(DataTypes.DATE) startedAt!: Date;
  @Required @Column(DataTypes.DATE) expiresAt!: Date;
  @Required @Column status!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
  @HasMany(() => VerificationGraceDiscrepancy, "graceId") sourceDiscrepancies!: VerificationGraceDiscrepancy[];
}
