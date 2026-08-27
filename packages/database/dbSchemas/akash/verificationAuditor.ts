import { DataTypes } from "sequelize";
import { Column, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { VerificationAttestation } from "./verificationAttestation"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_auditor",
  underscored: true,
  indexes: [{ fields: ["status"] }, { fields: ["renewal_deadline"] }]
})
export class VerificationAuditor extends Model {
  @Required @PrimaryKey @Column address!: string;
  @Required @Column status!: number;
  @Required @Column maxAttestationTier!: number;
  @Required @Column bondDenom!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) bondAmount!: string;
  @Required @Column bondStatus!: number;
  @Column(DataTypes.BLOB) metadataHash?: Buffer;
  @Required @Column(DataTypes.DATE) registeredAt!: Date;
  @Required @Column(DataTypes.DATE) renewalDeadline!: Date;
  @Required @Column(DataTypes.DECIMAL(20, 0)) discrepancyCount!: string;
  @Column(DataTypes.DATE) bondUnbondingCompletionTime?: Date;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @HasMany(() => VerificationAttestation, { foreignKey: "auditor", constraints: false }) attestations!: VerificationAttestation[];
}
