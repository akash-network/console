import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";
import { AlertEvent } from "./alertEvent";
import { AlertMonitoredValue } from "./alertMonitoredValue";
import { AlertTrigger } from "./alertTrigger";

@Table({ modelName: "userAlert", indexes: [{ fields: ["userId"] }] })
export class UserAlert extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Required @Column name: string;
  @Required @Column chain: string;
  @Required @Column type: string;
  @Required @Column isRecurring: boolean;
  @Column cooldown: string;
  @Required @Column channels: string;
  @Column note?: string;
  @Required @Default(false) @Column enabled: boolean;
  @Required @Default(false) @Column isDeleted: boolean;
  @Column deletedOn?: Date;
  @Column(DataTypes.UUID) oldVersionOfId?: string;
  @Required @Column createdOn: Date;
  @Column updatedOn?: Date;
  @Required @Default(0) @Column eventCount: number;
  @Column webhookUrl?: string;

  @BelongsTo(() => UserAlert, { foreignKey: "oldVersionOfId", targetKey: "id" }) oldVersionOf: UserAlert;
  @HasMany(() => AlertTrigger, "alertId") alertTriggers: AlertTrigger[];
  @HasMany(() => AlertMonitoredValue, "alertId") alertMonitoredValues: AlertMonitoredValue[];
  @HasMany(() => AlertEvent, "alertId") alertEvents: AlertEvent[];
}
