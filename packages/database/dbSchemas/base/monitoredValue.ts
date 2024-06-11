import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "monitoredValue",
  indexes: [{ unique: true, fields: ["tracker", "target"] }]
})
export class MonitoredValue extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column tracker: string;
  @Required @Column target: string;
  @Column value?: string;
  @Column lastUpdateDate?: Date;
}
