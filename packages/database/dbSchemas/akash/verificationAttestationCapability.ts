import { DataTypes } from "sequelize";
import { Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  tableName: "verification_attestation_capability",
  underscored: true,
  indexes: [{ fields: ["capability", "provider"] }]
})
export class VerificationAttestationCapability extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @PrimaryKey @Column auditor!: string;
  @Required @PrimaryKey @Column capability!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;
}
