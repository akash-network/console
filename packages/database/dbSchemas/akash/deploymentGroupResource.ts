import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { DeploymentGroup } from "./deploymentGroup";

/**
 * DeploymentGroupResource model for Akash
 *
 * A DeploymentGroupResource is a resource that is associated with a deployment group.
 * It is created when a deployment group is created and is used to track the resources associated with the deployment group.
 */
@Table({ modelName: "deploymentGroupResource", indexes: [{ unique: false, fields: ["deploymentGroupId"] }] })
export class DeploymentGroupResource extends Model {
  /**
   * The unique identifier for the database deployment group resource
   */
  @Required @Column(DataTypes.UUID) deploymentGroupId!: string;
  /**
   * The cpu units of the deployment group resource in thousandths of a CPU
   * 1000 CPU units = 1 CPU
   */
  @Required @Column cpuUnits!: number;
  /**
   * The gpu units of the deployment group resource
   * 1 GPU unit = 1 GPU
   */
  @Required @Column gpuUnits!: number;
  /**
   * The gpu vendor of the deployment group resource
   */
  @Column gpuVendor!: string;
  /**
   * The gpu model of the deployment group resource
   */
  @Column gpuModel!: string;
  /**
   * The memory quantity of the deployment group resource in bytes
   */
  @Required @Column(DataTypes.BIGINT) memoryQuantity!: number;
  /**
   * The ephemeral storage quantity of the deployment group resource in bytes
   */
  @Required @Column(DataTypes.BIGINT) ephemeralStorageQuantity!: number;
  /**
   * The persistent storage quantity of the deployment group resource in bytes
   */
  @Required @Column(DataTypes.BIGINT) persistentStorageQuantity!: number;
  /**
   * The count of the deployment group resource
   */
  @Required @Column count!: number;
  /**
   * The price of the deployment group resource in the denom specified in the denom column of the deployment
   */
  @Required @Column(DataTypes.DOUBLE) price!: number;
  /**
   * The deployment group associated with the deployment group resource
   */
  @BelongsTo(() => DeploymentGroup, "deploymentGroupId") deploymentGroup!: DeploymentGroup;
}
