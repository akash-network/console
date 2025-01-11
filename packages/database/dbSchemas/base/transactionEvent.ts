import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { TransactionEventAttribute } from "./transactionEventAttribute";
import { Transaction } from "./transaction";

@Table({
  modelName: "transaction_event",
  indexes: [
    { unique: false, fields: ["height"] },
    { unique: true, fields: ["tx_id", "index"] }
  ]
})
export class TransactionEvent extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column height: number;
  @Required @Column({ type: DataTypes.UUID, field: "tx_id" }) txId: string;
  @Required @Column index: number;
  @Required @Column type: string;

  @BelongsTo(() => Transaction, "tx_id") transaction: Transaction;
  @HasMany(() => TransactionEventAttribute, "transaction_event_id") attributes?: TransactionEventAttribute[];
}
