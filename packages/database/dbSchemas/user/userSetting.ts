import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Template } from "./template";

/**
 * User setting model for Akash users
 *
 * This is used to store the user setting data of a user
 */
@Table({
  modelName: "userSetting",
  indexes: [
    { unique: true, fields: ["userId"] },
    { unique: true, fields: ["username"] }
  ]
})
export class UserSetting extends Model {
  /**
   * The database ID of the user setting
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The user ID of the user
   * This is the auth0 ID of the user
   */
  @Column userId: string;
  /**
   * The username of the user
   */
  @Column username: string;
  /**
   * The email of the user
   */
  @Column email?: string;
  /**
   * Whether the email of the user setting is verified
   */
  @Required @Default(false) @Column emailVerified: boolean;
  /**
   * The Stripe customer ID of the user setting
   */
  @Column stripeCustomerId?: string;
  /**
   * The bio of the user setting
   */
  @Column(DataTypes.TEXT) bio?: string;
  /**
   * Whether the user setting is subscribed to the newsletter
   */
  @Required @Default(false) @Column subscribedToNewsletter: boolean;
  /**
   * The YouTube username of the user setting
   */
  @Column youtubeUsername?: string;
  /**
   * The Twitter username of the user setting
   */
  @Column twitterUsername?: string;
  /**
   * The GitHub username of the user setting
   */
  @Column githubUsername?: string;
  /**
   * The last IP address of the user setting
   */
  @Column({ field: "last_ip" }) lastIp?: string;
  /**
   * The last user agent of the user setting
   */
  @Column({ field: "last_user_agent" }) lastUserAgent?: string;
  /**
   * The last fingerprint of the user setting
   */
  @Column({ field: "last_fingerprint" }) lastFingerprint?: string;
  /**
   * The templates of the user setting
   */
  @HasMany(() => Template, { foreignKey: "userId", sourceKey: "userId" }) templates: Template[];
}
