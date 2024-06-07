import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Deployment } from "./deployment";
import { DeploymentGroupResource } from "./deploymentGroupResource";
import { Lease } from "./lease";

@Table({
  modelName: "deploymentGroup",
  indexes: [
    {
      unique: false,
      fields: ["owner", "dseq", "gseq"]
    }
  ]
})
export class DeploymentGroup extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) deploymentId: string;
  @Required @Column owner: string;
  @Required @Column dseq: string;
  @Required @Column gseq: number;

  @BelongsTo(() => Deployment, "deploymentId") deployment: Deployment;
  @HasMany(() => Lease, "deploymentGroupId") leases: Lease[];
  @HasMany(() => DeploymentGroupResource, "deploymentGroupId") deploymentGroupResources: DeploymentGroupResource[];
}
