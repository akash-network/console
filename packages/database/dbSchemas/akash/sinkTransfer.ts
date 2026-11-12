import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base/block";
import { Required } from "../decorators/requiredDecorator";

/** One row per x/sink transfer, keyed by the creation height and per-block sequence of its chain id because sequences restart every block. */
@Table({
  tableName: "sink_transfer",
  underscored: true,
  indexes: [
    { unique: false, fields: ["owner"] },
    { unique: false, fields: ["amount"] }
  ]
})
export class SinkTransfer extends Model {
  @Required @PrimaryKey @Column(DataTypes.INTEGER) height!: number;
  @Required @PrimaryKey @Column(DataTypes.INTEGER) sequence!: number;
  @BelongsTo(() => Block, "height") block!: Block;
  @Required @Column owner!: string;
  @Required @Column recipient!: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) amount!: string;
  @Required @Column status!: string;
  @Required @Default(false) @Column hasVoidOrder!: boolean;
  @Required @Column statusHeight!: number;
  @BelongsTo(() => Block, "statusHeight") statusBlock!: Block;
}
