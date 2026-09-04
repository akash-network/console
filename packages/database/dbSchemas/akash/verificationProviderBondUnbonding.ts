import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { VerificationProviderBond } from "./verificationProviderBond"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_provider_bond_unbonding",
  underscored: true,
  indexes: [{ fields: ["completion_time"] }]
})
export class VerificationProviderBondUnbonding extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @PrimaryKey @Column entryIndex!: number;
  @Required @Column denom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) amount!: string;
  @Required @Column(DataTypes.DATE) completionTime!: Date;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => VerificationProviderBond, "provider") providerBond!: VerificationProviderBond;
}
