import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Template } from "./template";

/**
 * Template favorite model for Akash users
 *
 * This is used to store the template favorite data of a user
 */
@Table({ modelName: "templateFavorite", indexes: [{ unique: true, fields: ["userId", "templateId"] }] })
export class TemplateFavorite extends Model {
  /**
   * The database ID of the template favorite
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The user ID of the template favorite
   */
  @Required @Column userId: string;
  /**
   * The template ID of the template favorite
   */
  @Required @Column(DataTypes.UUID) templateId: string;
  /**
   * The date when the template was added
   */
  @Required @Column addedDate: Date;
  /**
   * The template that this template favorite belongs to
   */
  @BelongsTo(() => Template, "templateId") template: Template;
}
