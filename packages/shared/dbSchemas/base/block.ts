import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Day } from "./day";
import { Validator } from "./validator";
import { Transaction } from "./transaction";
import { Message } from "./message";
import { Required } from "../decorators/requiredDecorator";

export const tableConfig = {
  modelName: "block",
  indexes: [
    { unique: false, fields: ["datetime"] },
    { unique: false, fields: ["dayId"] },
    { unique: false, fields: ["height", "isProcessed"] }
  ]
};

@Table(tableConfig)
export class Block extends Model {
  @PrimaryKey @Column height: number;
  @Required @Column datetime: Date;
  @Required @Column hash: string;
  @Required @Column proposer: string;
  @Required @Column(DataTypes.UUID) dayId: string;
  @Required @Column txCount: number;
  // Stats
  @Required @Default(false) @Column isProcessed: boolean;
  @Required @Column(DataTypes.BIGINT) totalTxCount: number;

  @BelongsTo(() => Day, { foreignKey: "dayId", constraints: false }) day: Day;
  @BelongsTo(() => Validator, { foreignKey: "proposer", targetKey: "hexAddress", constraints: false }) proposerValidator: Validator;
  @HasMany(() => Transaction, "height") transactions: Transaction[];
  @HasMany(() => Message, "height") messages: Message[];
}
