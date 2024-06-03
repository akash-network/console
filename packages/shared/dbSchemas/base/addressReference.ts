import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Message } from "./message";
import { Transaction } from "./transaction";

@Table({
  modelName: "addressReference",
  indexes: [
    { unique: false, fields: ["transactionId"] },
    { unique: false, fields: ["address"] }
  ]
})
export class AddressReference extends Model {
  @Required @Column(DataTypes.UUID) transactionId: string;
  @Column(DataTypes.UUID) messageId?: string;
  @Required @Column address: string;
  @Required @Column type: string;

  @BelongsTo(() => Message, "messageId") message?: Message;
  @BelongsTo(() => Transaction, "transactionId") transaction: Transaction;
}
