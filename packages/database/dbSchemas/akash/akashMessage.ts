import { DataTypes } from "sequelize";
import { Column, Table } from "sequelize-typescript";

import { Message } from "../base";
import { tableConfig } from "../base/message";

@Table({
  ...tableConfig,
  indexes: [...tableConfig.indexes, { unique: false, fields: ["relatedDeploymentId"] }]
})
export class AkashMessage extends Message {
  @Column(DataTypes.UUID) relatedDeploymentId?: string;
}
