import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  tableName: "verification_provider_tier_stream",
  underscored: true
})
export class VerificationProviderTierStream extends Model {
  @Required @PrimaryKey @Column(DataTypes.SMALLINT) id!: number;
  @Required @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) streamId!: string;
}
