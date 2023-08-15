import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";

@Table({ modelName: "alertTriggerCondition", indexes: [{ fields: ["alertTriggerId"] }] })
export class AlertTriggerCondition extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) alertTriggerId: string;
  @Required @Column key: string;
  @Required @Column operator: string;
  @Required @Column value: string;
  @Column unit?: string;
}
