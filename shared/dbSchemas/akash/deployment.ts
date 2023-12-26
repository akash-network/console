import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";
import { DataTypes, UUIDV4 } from "sequelize";
import { DeploymentGroup } from "./deploymentGroup";
import { Lease } from "./lease";
import { Message, Block } from "../base";
import { Required } from "../decorators/requiredDecorator";

@Table({ modelName: "deployment" })
export class Deployment extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  @Required @Column owner: string;
  @Required @Column dseq: string;
  @Required @Column createdHeight: number;
  @Required @Column(DataTypes.DOUBLE) balance: number;
  @Required @Column(DataTypes.BIGINT) deposit: number;
  @Required @Column denom: string;
  @Column lastWithdrawHeight?: number;
  @Required @Column(DataTypes.DOUBLE) withdrawnAmount!: number;
  @Column closedHeight?: number;

  @BelongsTo(() => Block, "createdHeight") createdBlock: Block;
  @BelongsTo(() => Block, "closedHeight") closedBlock: Block;
  @HasMany(() => DeploymentGroup, "deploymentId") deploymentGroups: DeploymentGroup[];
  @HasMany(() => Lease, "deploymentId") leases: Lease[];
  @HasMany(() => Message, { foreignKey: "relatedDeploymentId", constraints: false }) relatedMessages: Message[];
}
