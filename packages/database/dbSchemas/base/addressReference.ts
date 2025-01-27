import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Message } from "./message";
import { Transaction } from "./transaction";

/**
 * AddressReference model for Base
 *
 * This is used to store the reference of an address to a transaction or message
 */
@Table({
  modelName: "addressReference",
  indexes: [
    { unique: false, fields: ["transactionId"] },
    { unique: false, fields: ["address"] }
  ]
})
export class AddressReference extends Model {
  /**
   * The ID of the database transaction that this address reference belongs to
   */
  @Required @Column(DataTypes.UUID) transactionId: string;
  /**
   * The ID of the database message that this address reference belongs to
   */
  @Column(DataTypes.UUID) messageId?: string;
  /**
   * The address that this reference belongs to
   */
  @Required @Column address: string;
  /**
   * The type of the reference
   * ex: Signer, Receiver, Sender.
   */
  @Required @Column type: string;

  /**
   * The message that this address reference belongs to
   */
  @BelongsTo(() => Message, "messageId") message?: Message;
  /**
   * The transaction that this address reference belongs to
   */
  @BelongsTo(() => Transaction, "transactionId") transaction: Transaction;
}
