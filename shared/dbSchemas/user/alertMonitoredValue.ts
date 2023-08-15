import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";
import { UserAlert } from "./userAlert";

@Table({ modelName: "alertMonitoredValue" })
export class AlertMonitoredValue extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) alertId: string;
  @Required @Column target: string;
  @Required @Column operator: string;
  @Required @Column value: string;
  @Required @Default(false) @Column isMatching: boolean;

  @BelongsTo(() => UserAlert, "alertId") userAlert: UserAlert;
}
