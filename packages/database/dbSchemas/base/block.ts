import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Day } from "./day";
import { Message } from "./message";
import { Transaction } from "./transaction";
import { Validator } from "./validator";

export const tableConfig = {
  modelName: "block",
  indexes: [
    { unique: false, fields: ["datetime"] },
    { unique: false, fields: ["dayId"] },
    { unique: false, fields: ["height", "isProcessed"] }
  ]
};

/**
 * Block model for Akash
 *
 * This is used to store the block data
 */
@Table(tableConfig)
export class Block extends Model {
  /**
   * The height of the block
   */
  @PrimaryKey @Column height!: number;
  /**
   * The datetime of the block
   */
  @Required @Column datetime!: Date;
  /**
   * The hash of the block
   */
  @Required @Column hash!: string;
  /**
   * The proposer of the block (validator)
   */
  @Required @Column proposer!: string;
  /**
   * The ID of the day that this block belongs to
   */
  @Required @Column(DataTypes.UUID) dayId!: string;
  /**
   * The number of transactions in the block
   */
  @Required @Column txCount!: number;

  // Stats
  /**
   * Whether the block has been processed by the indexer
   */
  @Required @Default(false) @Column isProcessed!: boolean;
  /**
   * The total number of transactions in the block
   */
  @Required @Column(DataTypes.BIGINT) totalTxCount!: number;

  /**
   * The day that this block belongs to
   */
  @BelongsTo(() => Day, { foreignKey: "dayId", constraints: false }) day!: Day;
  /**
   * The validator that proposed this block
   */
  @BelongsTo(() => Validator, { foreignKey: "proposer", targetKey: "hexAddress", constraints: false }) proposerValidator!: Validator;
  /**
   * The transactions in the block
   */
  @HasMany(() => Transaction, "height") transactions!: Transaction[];
  /**
   * The messages in the block
   */
  @HasMany(() => Message, "height") messages!: Message[];
}
