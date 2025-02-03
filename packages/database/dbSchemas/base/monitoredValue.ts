import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * MonitoredValue model for Akash
 *
 * This is used to store the monitored value data for notification process
 */
@Table({
  modelName: "monitoredValue",
  indexes: [{ unique: true, fields: ["tracker", "target"] }]
})
export class MonitoredValue extends Model {
  /**
   * The database ID of the monitored value
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The tracker of the monitored value
   */
  @Required @Column tracker: string;
  /**
   * The target of the monitored value
   */
  @Required @Column target: string;
  /**
   * The value of the monitored value
   */
  @Column value?: string;
  /**
   * The last update date of the monitored value
   */
  @Column lastUpdateDate?: Date;
}
