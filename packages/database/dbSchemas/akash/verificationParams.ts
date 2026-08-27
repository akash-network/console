import { DataTypes } from "sequelize";
import { Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  tableName: "verification_params",
  underscored: true
})
export class VerificationParams extends Model {
  @Required @PrimaryKey @Column(DataTypes.SMALLINT) id!: number;
  @Required @Column(DataTypes.JSONB) params!: Record<string, unknown>;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;
}
