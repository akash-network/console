import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base/block";
import { Required } from "../decorators/requiredDecorator";

/** Durable staging for verification invalidation signals from finalize_block_events. */
@Table({
  tableName: "verification_block_event",
  underscored: true,
  indexes: [{ unique: true, fields: ["height", "index"] }, { fields: ["height", "is_processed"] }]
})
export class VerificationBlockEvent extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column height!: number;
  @BelongsTo(() => Block, "height") block!: Block;
  @Required @Column index!: number;
  @Required @Column type!: string;
  @Required @Column(DataTypes.JSONB) data!: Record<string, string | null>;
  @Required @Default(false) @Column isProcessed!: boolean;
}
