import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes, UUIDV4 } from "sequelize";
import { Required } from "../decorators/requiredDecorator";
import { Template } from "./template";

@Table({ modelName: "templateFavorite", indexes: [{ unique: true, fields: ["userId", "templateId"] }] })
export class TemplateFavorite extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Required @Column(DataTypes.UUID) templateId: string;
  @Required @Column addedDate: Date;

  @BelongsTo(() => Template, "templateId") template: Template;
}
