import { Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * ProviderAttribute model for Akash
 *
 * Provider attributes are used to store additional information about a provider. (MsgCreateProvider & MsgUpdateProvider)
 * This is used to store information about the provider's location, resource specifications, such as the country, region, city, etc.
 */
@Table({
  modelName: "providerAttribute",
  indexes: [{ unique: false, fields: ["provider"] }]
})
export class ProviderAttribute extends Model {
  /**
   * The provider address that the attribute belongs to
   */
  @Required @Column provider!: string;
  /**
   * The key of the attribute
   */
  @Required @Column key!: string;
  /**
   * The value of the attribute
   */
  @Required @Column value!: string;
}
