import { Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * ProviderAttributeSignature model for Akash
 *
 * This is used to store the signature of the provider attribute. (MsgSignProviderAttributes & MsgDeleteProviderAttributes)
 * It is used to verify the authenticity of the attribute.
 * The auditor is the address of the auditor that signed the attribute.
 */
@Table({
  modelName: "providerAttributeSignature",
  indexes: [{ unique: false, fields: ["provider"] }]
})
export class ProviderAttributeSignature extends Model {
  /**
   * The provider address that the attribute belongs to
   */
  @Required @Column provider!: string;
  /**
   * The auditor address that signed the attribute
   */
  @Required @Column auditor!: string;
  /**
   * The key of the attribute that was signed
   */
  @Required @Column key!: string;
  /**
   * The value of the attribute that was signed
   */
  @Required @Column value!: string;
}
