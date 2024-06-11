import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "userAddressName",
  indexes: [{ unique: true, fields: ["userId", "address"] }]
})
export class UserAddressName extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Required @Column address: string;
  @Required @Column name: string;
}
