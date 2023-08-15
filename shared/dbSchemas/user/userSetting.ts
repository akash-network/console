import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes, UUIDV4 } from "sequelize";
import { Required } from "../decorators/requiredDecorator";
import { Template } from "./template";
import { UserAlert } from "./userAlert";

@Table({
  modelName: "userSetting",
  indexes: [
    { unique: true, fields: ["userId"] },
    { unique: true, fields: ["username", "accountType"] }
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
  // Temporary field to identify the type of account between cloudmos and blockspy.io
  @Required
  @Default("cloudmos")
  @Column
  accountType: string;

  @HasMany(() => Template, { foreignKey: "userId", sourceKey: "userId" }) templates: Template[];
  @HasMany(() => UserAlert, { foreignKey: "userId", sourceKey: "userId" }) userAlerts: UserAlert[];
}
