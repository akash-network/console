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

@Table(tableConfig)
export class Message extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column(DataTypes.UUID) txId: string;
  @Required @Column height: number;
  @Required @Column type: string;
  @Required @Column typeCategory: string;
  @Required @Column index: number;
  @Required @Column indexInBlock: number;
  @Required @Default(false) @Column isProcessed: boolean;
  @Required @Default(false) @Column isNotificationProcessed: boolean;
  @Column(DataTypes.DECIMAL(30, 0)) amount?: string;
  @Required @Column(DataTypes.BLOB) data: Uint8Array;

  @BelongsTo(() => Transaction, "txId") transaction: Transaction;
  @BelongsTo(() => Block, "height") block: Block;
  @HasMany(() => AddressReference, "messageId") addressReferences: AddressReference[];
}
