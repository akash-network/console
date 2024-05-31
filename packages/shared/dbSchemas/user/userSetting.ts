import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes, UUIDV4 } from "sequelize";
import { Required } from "../decorators/requiredDecorator";
import { Template } from "./template";

@Table({
  modelName: "userSetting",
  indexes: [
    { unique: true, fields: ["userId"] },
    { unique: true, fields: ["username"] }
  ]
})
export class UserSetting extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column userId: string;
  @Required @Column username: string;
  @Column email?: string;
  @Required @Default(false) @Column emailVerified: boolean;
  @Column stripeCustomerId?: string;
  @Column(DataTypes.TEXT) bio?: string;
  @Required @Default(false) @Column subscribedToNewsletter: boolean;
  @Column youtubeUsername?: string;
  @Column twitterUsername?: string;
  @Column githubUsername?: string;

  @HasMany(() => Template, { foreignKey: "userId", sourceKey: "userId" }) templates: Template[];
}
