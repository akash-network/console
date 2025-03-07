import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * Validator model for Akash
 *
 * This is used to store the validator data
 */
@Table({
  modelName: "validator",
  indexes: [
    { unique: true, fields: ["id"] },
    { unique: true, fields: ["operatorAddress"] },
    { unique: true, fields: ["accountAddress"] },
    { unique: true, fields: ["hexAddress"] }
  ]
})
export class Validator extends Model {
  /**
   * The database ID of the validator
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The operator address of the validator
   */
  @Required @Column operatorAddress!: string;
  /**
   * The account address of the validator
   */
  @Required @Column accountAddress!: string;
  /**
   * The hex address of the validator
   */
  @Required @Column hexAddress!: string;
  /**
   * The ID of the message that created this validator
   * Message which created the validator (MsgCreateValidator).
   */
  @Column(DataTypes.UUID) createdMsgId?: string;
  /**
   * The moniker of the validator
   */
  @Required @Column moniker!: string;
  /**
   * The identity of the validator
   */
  @Column identity?: string;
  /**
   * The website of the validator
   */
  @Column website?: string;
  /**
   * The description of the validator
   */
  @Column(DataTypes.TEXT) description?: string;
  /**
   * The security contact of the validator
   */
  @Column securityContact?: string;
  /**
   * The rate of the validator
   */
  @Required @Column(DataTypes.DOUBLE) rate!: number;
  /**
   * The maximum rate of the validator
   */
  @Required @Column(DataTypes.DOUBLE) maxRate!: number;
  /**
   * The maximum change rate of the validator
   */
  @Required @Column(DataTypes.DOUBLE) maxChangeRate!: number;
  /**
   * The minimum self delegation of the validator
   */
  @Required @Column(DataTypes.BIGINT) minSelfDelegation!: number;
  /**
   * The keybase username of the validator
   */
  @Column keybaseUsername?: string;
  /**
   * The keybase avatar URL of the validator
   */
  @Column keybaseAvatarUrl?: string;
}
