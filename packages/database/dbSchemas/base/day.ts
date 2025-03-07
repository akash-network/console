import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Block } from "./block";

/**
 * Day model for Akash
 *
 * This is used to store the day data
 */
@Table({
  modelName: "day",
  indexes: [
    { unique: true, fields: ["date"] },
    { unique: true, fields: ["firstBlockHeight"] },
    { unique: true, fields: ["lastBlockHeight"] }
  ]
})
export class Day extends Model {
  /**
   * The database ID of the day
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The date of the day
   */
  @Required @Column date!: Date;
  /**
   * The price of AKT on this day
   */
  @Column(DataTypes.DOUBLE) aktPrice?: number;
  /**
   * The height of the first block in this day
   */
  @Required @Column firstBlockHeight!: number;
  /**
   * The height of the last block in this day
   */
  @Column lastBlockHeight?: number;
  /**
   * The height of the last block in this day that has been processed by the indexer yet
   */
  @Required @Column lastBlockHeightYet!: number;
  /**
   * Whether the price of AKT has changed on this day
   */
  @Required @Default(false) @Column aktPriceChanged!: boolean;

  /**
   * The blocks in this day
   */
  @HasMany(() => Block, { foreignKey: "dayId", constraints: false }) blocks!: Block[];
  /**
   * The first block in this day
   */
  @BelongsTo(() => Block, { foreignKey: "firstBlockHeight", constraints: false }) firstBlock!: Block;
  /**
   * The last block in this day
   */
  @BelongsTo(() => Block, { foreignKey: "lastBlockHeight", constraints: false }) lastBlock?: Block;
  /**
   * The last block in this day that has been processed by the indexer
   */
  @BelongsTo(() => Block, { foreignKey: "lastBlockHeightYet", constraints: false }) lastBlockYet!: Block;
}
