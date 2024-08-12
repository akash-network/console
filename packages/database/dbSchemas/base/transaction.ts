import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { AddressReference } from "./addressReference";
import { Block } from "./block";
import { Message } from "./message";

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
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column hash: string;
  @Required @Column index: number;
  @Required @Column height: number;
  @Required @Column msgCount: number;
  @Column multisigThreshold?: number;
  @Required @Column gasUsed: number;
  @Required @Column gasWanted: number;
  @Required @Column(DataTypes.DECIMAL(30, 0)) fee: string;
  @Required @Column(DataTypes.TEXT) memo: string;
  @Required @Default(false) @Column isProcessed: boolean;
  @Required @Default(false) @Column hasProcessingError: boolean;
  @Column(DataTypes.TEXT) log?: string;

  @BelongsTo(() => Block, "height") block: Block;
  @HasMany(() => Message, "txId") messages?: Message[];
  @HasMany(() => AddressReference, "transactionId") addressReferences?: AddressReference[];
}
