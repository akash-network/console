import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { AddressReference } from "./addressReference";
import { Block } from "./block";
import { Transaction } from "./transaction";

export const tableConfig = {
  modelName: "message",
  indexes: [
    { unique: false, fields: ["txId"] },
    { unique: false, fields: ["height"] },
    { unique: false, fields: ["txId", "isProcessed"] },
    { unique: false, fields: ["height", "type"] },
    { unique: false, fields: ["height", "isNotificationProcessed"], where: { isNotificationProcessed: false } },
    { unique: false, fields: ["height"], where: { isNotificationProcessed: false }, name: "message_height_is_notification_processed_false" },
    { unique: false, fields: ["height"], where: { isNotificationProcessed: true }, name: "message_height_is_notification_processed_true" }
  ]
};

/**
 * Message model for Akash
 *
 * This is used to store the transaction message data
 */
@Table(tableConfig)
export class Message extends Model {
  /**
   * The database ID of the message
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The ID of the transaction that this message belongs to
   */
  @Required @Column(DataTypes.UUID) txId!: string;
  /**
   * The height of the block that this message belongs to
   */
  @Required @Column height!: number;
  /**
   * The type of the message (ex: /akash.market.v1beta4.MsgWithdrawLease)
   */
  @Required @Column type!: string;
  /**
   * The category of the message (ex: ibc, akash, cosmos)
   */
  @Required @Column typeCategory!: string;
  /**
   * The index of the message in the transaction
   */
  @Required @Column index!: number;
  /**
   * The index of the message in the block
   */
  @Required @Column indexInBlock!: number;
  /**
   * Whether the message has been processed by the indexer
   */
  @Required @Default(false) @Column isProcessed!: boolean;
  /**
   * Whether the message has been processed by the notification service
   */
  @Required @Default(false) @Column isNotificationProcessed!: boolean;
  /**
   * The amount of the message
   * This is only used for messages that have an amount (ex: MsgDelegate, MsgSend, etc.)
   */
  @Column(DataTypes.DECIMAL(30, 0)) amount?: string;
  /**
   * The protobuf encoded data of the message
   */
  @Required @Column(DataTypes.BLOB) data!: Uint8Array;

  /**
   * The transaction that this message belongs to
   */
  @BelongsTo(() => Transaction, "txId") transaction!: Transaction;
  /**
   * The block that this message belongs to
   */
  @BelongsTo(() => Block, "height") block!: Block;
  /**
   * The address references of the message
   */
  @HasMany(() => AddressReference, "messageId") addressReferences!: AddressReference[];
}
