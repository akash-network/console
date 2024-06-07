import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { TemplateFavorite } from "./templateFavorite";
import { UserSetting } from "./userSetting";

@Table({ modelName: "template", indexes: [{ fields: ["userId"] }] })
export class Template extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Column(DataTypes.UUID) copiedFromId?: string;
  @Required @Column title: string;
  @Column(DataTypes.TEXT) description?: string;
  @Required @Default(false) @Column isPublic: boolean;
  @Required @Column(DataTypes.BIGINT) cpu: number;
  @Required @Column(DataTypes.BIGINT) ram: number;
  @Required @Column(DataTypes.BIGINT) storage: number;
  @Required @Column(DataTypes.TEXT) sdl: string;

  @BelongsTo(() => UserSetting, { foreignKey: "userId", targetKey: "userId" }) userSetting: UserSetting;
  @HasMany(() => TemplateFavorite, "templateId") templateFavorites: TemplateFavorite[];

  // Self reference to keep track of Save as
  @BelongsTo(() => Template, "copiedFromId") copiedFrom: Template;
}
