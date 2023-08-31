import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { DeploymentGroup } from "./deploymentGroup";
import { Deployment } from "./deployment";
import { Provider } from "./provider";
import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "lease",
  indexes: [
    { unique: false, fields: ["closedHeight"] },
    { unique: false, fields: ["predictedClosedHeight"] },
    { unique: false, fields: ["deploymentId"] },
    { unique: false, fields: ["owner", "dseq", "gseq", "oseq"] }
  ]
})
export class Lease extends Model {
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column(DataTypes.UUID) deploymentId: string;
  @Required @Column(DataTypes.UUID) deploymentGroupId: string;
  @Required @Column owner: string;
  @Required @Column dseq: string;
  @Required @Column oseq: number;
  @Required @Column gseq: number;
  @Required @Column providerAddress: string;
  @Required @Column createdHeight: number;
  @Column closedHeight?: number;
  @Required @Column(DataTypes.BIGINT) predictedClosedHeight: number;
  @Required @Column(DataTypes.DOUBLE) price: number;
  @Required @Default(0) @Column(DataTypes.DOUBLE) withdrawnAmount: number;
  @Required @Column denom: string;

  // Stats
  @Required @Column cpuUnits: number;
  @Required @Column gpuUnits: number;
  @Required @Column(DataTypes.BIGINT) memoryQuantity: number;
  @Required @Column(DataTypes.BIGINT) ephemeralStorageQuantity: number;
  @Required @Column(DataTypes.BIGINT) persistentStorageQuantity: number;

  @BelongsTo(() => DeploymentGroup, "deploymentGroupId") deploymentGroup: DeploymentGroup;
  @BelongsTo(() => Deployment, "deploymentId") deployment: Deployment;
  @BelongsTo(() => Provider, "providerAddress") provider: Provider;
}
