import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base/block";
import { Required } from "../decorators/requiredDecorator";

/** One row per staking unbond or unbonding cancellation, keyed by the transaction event it was read from so authz-wrapped messages are included. */
@Table({
  tableName: "staking_unbonding",
  underscored: true,
  indexes: [
    { unique: false, fields: ["height"] },
    { unique: false, fields: ["delegator"] },
    { unique: false, fields: ["completion_time"] }
  ]
})
export class StakingUnbonding extends Model {
  @Required @PrimaryKey @Column(DataTypes.UUID) transactionEventId!: string;
  @Required @Column(DataTypes.INTEGER) height!: number;
  @BelongsTo(() => Block, "height") block!: Block;
  @Required @Column type!: string;
  @Required @Column delegator!: string;
  @Required @Column validator!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) amount!: string;
  @Column(DataTypes.DATE) completionTime?: Date;
  @Column(DataTypes.INTEGER) creationHeight?: number;
}
