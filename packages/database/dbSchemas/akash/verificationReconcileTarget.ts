import { DataTypes } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  tableName: "verification_reconcile_target",
  underscored: true,
  indexes: [{ fields: ["claimed_at", "next_attempt_at"] }, { fields: ["requested_height"] }]
})
export class VerificationReconcileTarget extends Model {
  @Required @PrimaryKey @Column targetType!: string;
  @Required @PrimaryKey @Column targetKey!: string;
  @Required @Column requestedHeight!: number;
  @Required @Default(true) @Column invalidated!: boolean;
  @Column(DataTypes.DATE) claimedAt?: Date;
  @Required @Default(0) @Column attemptCount!: number;
  @Column(DataTypes.DATE) nextAttemptAt?: Date;
  @Column(DataTypes.TEXT) lastError?: string;
}
