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
import { UserAlert } from "./userAlert";
import { UserSetting } from "./userSetting";

@Table({ modelName: "alertEvent", indexes: [{ fields: ["userId"] }] })
export class AlertEvent extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Required @Column(DataTypes.UUID) alertId: string;
  @Column msgId?: string;
  @Column txHash?: string;
  @Column height?: number;
  @Required @Column eventDate: Date;
  @Required @Column createdDate: Date;
  @Column(DataTypes.TEXT) payload?: string;

  @BelongsTo(() => UserAlert, "alertId") userAlert: UserAlert;
  @BelongsTo(() => UserSetting, { foreignKey: "userId", targetKey: "userId" })
  userSetting: UserSetting;
}
