import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * BmeStatusChange model
 *
 * Tracks circuit breaker status changes from EventMintStatusChange events.
 * Records transitions between mint statuses (healthy, warning, halt_cr, halt_oracle)
 * along with the collateral ratio that triggered the change.
 */
@Table({
  modelName: "bmeStatusChange",
  indexes: [{ unique: false, fields: ["height"] }]
})
export class BmeStatusChange extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column height!: number;
  @Required @Column previousStatus!: string;
  @Required @Column newStatus!: string;
  @Required @Column(DataTypes.DECIMAL(20, 10)) collateralRatio!: string;
}
