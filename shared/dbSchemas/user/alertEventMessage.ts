import { DataTypes, UUIDV4 } from "sequelize";
import {
  BelongsTo,
  Column,
  Default,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";
import { AlertEvent } from "./alertEvent";

@Table({
  modelName: "alertEventMessage",
  indexes: [{ fields: ["alertEventId"] }],
})
export class AlertEventMessage extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) alertEventId: string;
  @Column sentDate?: Date;
  @Column error?: string;
  @Column channel: string;
  @Column retryCount?: number;

  @BelongsTo(() => AlertEvent, "alertEventId") alertEvent: AlertEvent;
}
