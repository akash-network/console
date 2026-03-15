import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * BmeRawEvent model
 *
 * Staging table for BME block-level events extracted from end_block_events.
 * Only BME-relevant events are stored (EventLedgerRecordExecuted, EventMintStatusChange, EventVaultBalance, EventActSupply).
 * Marked as processed after the BmeIndexer consumes them.
 */
@Table({
  modelName: "bmeRawEvent",
  indexes: [
    { unique: true, fields: ["height", "index"] },
    { unique: false, fields: ["height", "isProcessed"] }
  ]
})
export class BmeRawEvent extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column height!: number;
  @Required @Column index!: number;
  @Required @Column type!: string;
  @Required @Column(DataTypes.JSONB) data!: Record<string, string | null>;
  @Required @Default(false) @Column isProcessed!: boolean;
}
