import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes, UUIDV4 } from "sequelize";
import { Block } from "./block";
import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "day",
  indexes: [
    { unique: true, fields: ["date"] },
    { unique: true, fields: ["firstBlockHeight"] },
    { unique: true, fields: ["lastBlockHeight"] }
  ]
})
export class Day extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column date: Date;
  @Column(DataTypes.DOUBLE) aktPrice?: number;
  @Required @Column firstBlockHeight: number;
  @Column lastBlockHeight?: number;
  @Required @Column lastBlockHeightYet: number;

  @HasMany(() => Block, { foreignKey: "dayId", constraints: false }) blocks: Block[];
  @BelongsTo(() => Block, { foreignKey: "firstBlockHeight", constraints: false }) firstBlock: Block;
  @BelongsTo(() => Block, { foreignKey: "lastBlockHeight", constraints: false }) lastBlock?: Block;
  @BelongsTo(() => Block, { foreignKey: "lastBlockHeightYet", constraints: false }) lastBlockYet: Block;
}
