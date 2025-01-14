import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

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
  @Column userId: string;
  @Column username: string;
  @Column email?: string;
  @Required @Default(false) @Column emailVerified: boolean;
  @Column stripeCustomerId?: string;
  @Column(DataTypes.TEXT) bio?: string;
  @Required @Default(false) @Column subscribedToNewsletter: boolean;
  @Column youtubeUsername?: string;
  @Column twitterUsername?: string;
  @Column githubUsername?: string;
  @Column({ field: "last_ip" }) lastIp?: string;
  @Column({ field: "last_user_agent" }) lastUserAgent?: string;
  @Column({ field: "last_fingerprint" }) lastFingerprint?: string;

  @HasMany(() => Template, { foreignKey: "userId", sourceKey: "userId" }) templates: Template[];
}
