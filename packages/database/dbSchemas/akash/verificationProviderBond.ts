import { DataTypes } from "sequelize";
import { BelongsTo, Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle
import { VerificationProviderBondUnbonding } from "./verificationProviderBondUnbonding"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_provider_bond",
  underscored: true
})
export class VerificationProviderBond extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @Column bondedDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) bondedAmount!: string;
  @Required @Column requiredForCurrentTierDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) requiredForCurrentTierAmount!: string;
  @Required @Column slashed!: boolean;
  @Column(DataTypes.DATE) lastSlashTime?: Date;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
  @HasMany(() => VerificationProviderBondUnbonding, "provider") unbondingEntries!: VerificationProviderBondUnbonding[];
}
