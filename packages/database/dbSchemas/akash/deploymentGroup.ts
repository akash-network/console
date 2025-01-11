import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Deployment } from "./deployment";
import { DeploymentGroupResource } from "./deploymentGroupResource";
import { Lease } from "./lease";

/**
 * DeploymentGroup model for Akash
 *
 * A DeploymentGroup is a group of resources that are associated with a deployment.
 * It is created when a deployment is created and is used to track the resources group associated with the deployment.
 */
@Table({
  modelName: "deploymentGroup",
  indexes: [
    {
      unique: true,
      fields: ["owner", "dseq", "gseq"]
    }
  ]
})
export class DeploymentGroup extends Model {
  /**
   * The unique identifier for the database deployment group
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * The unique identifier for the database deployment
   */
  @Required @Column(DataTypes.UUID) deploymentId: string;
  /**
   * The owner address of the deployment
   */
  @Required @Column owner: string;
  /**
   * The dseq of the deployment
   */
  @Required @Column dseq: string;
  /**
   * The gseq of the deployment group (unique identifier for the deployment group on the blockchain)
   */
  @Required @Column gseq: number;
  /**
   * The deployment associated with the deployment group
   */
  @BelongsTo(() => Deployment, "deploymentId") deployment: Deployment;
  /**
   * The leases associated with the deployment group
   */
  @HasMany(() => Lease, "deploymentGroupId") leases: Lease[];
  /**
   * The resources associated with the deployment group
   */
  @HasMany(() => DeploymentGroupResource, "deploymentGroupId") deploymentGroupResources: DeploymentGroupResource[];
}
