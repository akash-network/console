import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { TransactionEvent } from "./transactionEvent";

@Table({
  modelName: "transaction_event_attribute",
  indexes: [{ unique: true, fields: ["transaction_event_id", "index"] }]
})
export class TransactionEventAttribute extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column({ type: DataTypes.UUID, field: "transaction_event_id" }) transactionEventId!: string;
  @Required @Column index!: number;
  @Required @Column key!: string;
  @Column(DataTypes.TEXT) value!: string;

  @BelongsTo(() => TransactionEvent, "transaction_event_id") event!: TransactionEvent;
}
