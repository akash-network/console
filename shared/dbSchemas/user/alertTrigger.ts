import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";
import { AlertTriggerCondition } from "./alertTriggerCondition";
import { UserAlert } from "./userAlert";

@Table({ modelName: "alertTrigger", indexes: [{ fields: ["alertId"] }] })
export class AlertTrigger extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) alertId: string;
  @Required @Column msgType: string;

  @BelongsTo(() => UserAlert, "alertId") userAlert: UserAlert;
  @HasMany(() => AlertTriggerCondition, "alertTriggerId") alertTriggerConditions: AlertTriggerCondition[];
}
