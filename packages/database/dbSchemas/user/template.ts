import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { TemplateFavorite } from "./templateFavorite";
import { UserSetting } from "./userSetting";

/**
 * Template model for Akash users
 *
 * This is used to store the template data of a user
 */
@Table({ modelName: "template", indexes: [{ fields: ["userId"] }] })
export class Template extends Model {
  /**
   * The database ID of the template
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The user ID of the template
   */
  @Required @Column userId: string;
  /**
   * The template ID that this template was copied from
   */
  @Column(DataTypes.UUID) copiedFromId?: string;
  /**
   * The title of the template
   */
  @Required @Column title: string;
  /**
   * The description of the template
   */
  @Column(DataTypes.TEXT) description?: string;
  /**
   * Whether the template is public
   */
  @Required @Default(false) @Column isPublic: boolean;
  /**
   * The CPU of the template in thousandths of CPU
   * 1000 = 1 CPU
   */
  @Required @Column(DataTypes.BIGINT) cpu: number;
  /**
   * The RAM of the template in bytes
   */
  @Required @Column(DataTypes.BIGINT) ram: number;
  /**
   * The storage of the template in bytes
   */
  @Required @Column(DataTypes.BIGINT) storage: number;
  /**
   * The SDL of the template
   */
  @Required @Column(DataTypes.TEXT) sdl: string;
  /**
   * The user setting of the template
   */
  @BelongsTo(() => UserSetting, { foreignKey: "userId", targetKey: "userId" }) userSetting: UserSetting;
  /**
   * The template favorites of the template
   */
  @HasMany(() => TemplateFavorite, "templateId") templateFavorites: TemplateFavorite[];
  /**
   * The template that this template was copied from
   * Self reference to keep track of Save as
   */
  @BelongsTo(() => Template, "copiedFromId") copiedFrom: Template;
}
