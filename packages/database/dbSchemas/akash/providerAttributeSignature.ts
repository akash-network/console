import { Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "providerAttributeSignature",
  indexes: [{ unique: false, fields: ["provider"] }]
})
export class ProviderAttributeSignature extends Model {
  @Required @Column provider: string;
  @Required @Column auditor: string;
  @Required @Column key: string;
  @Required @Column value: string;
}
