import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base/block";
import { Required } from "../decorators/requiredDecorator";

/** One row per block whose transactions changed the x/sink totals, holding the absolute totals of akash.sink.v1.EventTotalsUpdated. */
@Table({ tableName: "sink_totals_snapshot", underscored: true })
export class SinkTotalsSnapshot extends Model {
  @Required @PrimaryKey @Column(DataTypes.INTEGER) height!: number;
  @BelongsTo(() => Block, "height") block!: Block;
  @Required @Column(DataTypes.DECIMAL(30, 0)) pendingAmount!: string;
  @Required @Column pendingCount!: number;
  @Required @Column(DataTypes.DECIMAL(30, 0)) mintedAmount!: string;
  @Required @Column mintedCount!: number;
  @Required @Column(DataTypes.DECIMAL(30, 0)) voidedAmount!: string;
  @Required @Column voidedCount!: number;
  @Required @Column(DataTypes.DECIMAL(30, 0)) refundPendingAmount!: string;
  @Required @Column refundPendingCount!: number;
  @Required @Column(DataTypes.DECIMAL(30, 0)) refundedAmount!: string;
  @Required @Column refundedCount!: number;
}
