import { DataTypes } from "sequelize";
import { Column, Table } from "sequelize-typescript";

import { Message } from "../base";
import { tableConfig } from "../base/message";

/**
 * Custom Message model for Akash
 *
 * This model extends the base Message model and adds additional columns for Akash specific metrics
 */
@Table({
  ...tableConfig,
  indexes: [...tableConfig.indexes, { unique: false, fields: ["relatedDeploymentId"] }]
})
export class AkashMessage extends Message {
  /**
   * The ID of the deployment that this message is related to
   */
  @Column(DataTypes.UUID) relatedDeploymentId?: string;
}
