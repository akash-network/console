import { Column, Model, Table } from "sequelize-typescript";
import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerAttribute",
  indexes: [{ unique: false, fields: ["provider"] }]
})
export class ProviderAttribute extends Model {
  @Required @Column provider: string;
  @Required @Column key: string;
  @Required @Column value: string;
}
