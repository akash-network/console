import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base/block"; // eslint-disable-line import-x/no-cycle
import { Required } from "../decorators/requiredDecorator";

/**
 * BmeRawEvent model
 *
 * Staging table for BME block-level events extracted from end_block_events.
 * Only BME-relevant events are stored (EventLedgerRecordExecuted, EventMintStatusChange, EventVaultSeeded).
 * Marked as processed after the BmeIndexer consumes them.
 */
@Table({
  tableName: "bme_raw_event",
  underscored: true,
  indexes: [
    { unique: true, fields: ["height", "index"] },
    { unique: false, fields: ["height", "is_processed"] }
  ]
})
export class BmeRawEvent extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column height!: number;
  @BelongsTo(() => Block, "height") block!: Block;
  @Required @Column index!: number;
  @Required @Column type!: string;
  @Required @Column(DataTypes.JSONB) data!: Record<string, string | null>;
  @Required @Default(false) @Column isProcessed!: boolean;
}
