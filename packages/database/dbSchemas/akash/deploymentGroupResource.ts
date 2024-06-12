import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { DeploymentGroup } from "./deploymentGroup";

@Table({ modelName: "deploymentGroupResource", indexes: [{ unique: false, fields: ["deploymentGroupId"] }] })
export class DeploymentGroupResource extends Model {
  @Required @Column(DataTypes.UUID) deploymentGroupId: string;
  @Required @Column cpuUnits: number;
  @Required @Column gpuUnits: number;
  @Column gpuVendor: string;
  @Column gpuModel: string;
  @Required @Column(DataTypes.BIGINT) memoryQuantity: number;
  @Required @Column(DataTypes.BIGINT) ephemeralStorageQuantity: number;
  @Required @Column(DataTypes.BIGINT) persistentStorageQuantity: number;
  @Required @Column count: number;
  @Required @Column(DataTypes.DOUBLE) price: number;

  @BelongsTo(() => DeploymentGroup, "deploymentGroupId") deploymentGroup: DeploymentGroup;
}
