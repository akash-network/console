import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { AddressReference } from "./addressReference";
import { Block } from "./block";
import { Message } from "./message";
import { TransactionEvent } from "./transactionEvent";

/**
 * Transaction model for Akash
 *
 * This is used to store the transaction data
 */
@Table({
  modelName: "transaction",
  indexes: [
    { unique: false, fields: ["height"] },
    { unique: false, fields: ["height", "isProcessed", "hasProcessingError"] },
    { unique: false, fields: ["hash"] },
    { unique: false, fields: ["id"], where: { hasProcessingError: false }, name: "transaction_id_has_procesing_error_false" }
  ]
})
export class Transaction extends Model {
  /**
   * The database ID of the transaction
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The hash of the transaction
   */
  @Required @Column hash: string;
  /**
   * The index of the transaction in the block
   */
  @Required @Column index: number;
  /**
   * The height of the block that this transaction belongs to
   */
  @Required @Column height: number;
  /**
   * The number of messages in the transaction
   */
  @Required @Column msgCount: number;
  /**
   * The threshold of the multisig transaction
   */
  @Column multisigThreshold?: number;
  /**
   * The amount of gas used in the transaction
   */
  @Required @Column gasUsed: number;
  /**
   * The amount of gas wanted in the transaction
   */
  @Required @Column gasWanted: number;
  /**
   * The fee of the transaction
   */
  @Required @Column(DataTypes.DECIMAL(30, 0)) fee: string;
  /**
   * The memo of the transaction
   */
  @Required @Column(DataTypes.TEXT) memo: string;
  /**
   * Whether the transaction has been processed by the indexer
   */
  @Required @Default(false) @Column isProcessed: boolean;
  /**
   * Whether the transaction has processing error
   */
  @Required @Default(false) @Column hasProcessingError: boolean;
  /**
   * The error message if the transaction failed
   */
  @Column(DataTypes.TEXT) log?: string;

  /**
   * The block that this transaction belongs to
   */
  @BelongsTo(() => Block, "height") block: Block;
  /**
   * The messages in this transaction
   */
  @HasMany(() => Message, "txId") messages?: Message[];
  /**
   * The events in this transaction
   */
  @HasMany(() => TransactionEvent, "tx_id") events: TransactionEvent[];
  /**
   * The address references in this transaction
   */
  @HasMany(() => AddressReference, "transactionId") addressReferences?: AddressReference[];
}
