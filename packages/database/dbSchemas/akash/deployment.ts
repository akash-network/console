import { DataTypes, UUIDV4 } from "sequelize";
import { BelongsTo, Column, Default, HasMany, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block, Message } from "../base";
import { Required } from "../decorators/requiredDecorator";
import { DeploymentGroup } from "./deploymentGroup";
import { Lease } from "./lease";

/**
 * Deployment model for Akash
 *
 * Deployments are created when a user creates a deployment on the blockchain. (MsgCreateDeployment)
 * They are used to track the state of a deployment and the associated leases.
 */
@Table({
  modelName: "deployment",
  indexes: [
    {
      fields: ["createdHeight", "closedHeight"]
    },
    {
      fields: ["owner"]
    }
  ]
})
export class Deployment extends Model {
  /**
   * The unique identifier for the database deployment
   */
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id: string;
  /**
   * Address of the wallet that owns this deployment
   */
  @Required @Column owner: string;
  /**
   * The dseq of the deployment (unique identifier for the deployment on the blockchain)
   */
  @Required @Column dseq: string;
  /**
   * The block height at which the deployment was created (MsgCreateDeployment)
   */
  @Required @Column createdHeight: number;
  /**
   * The balance of the deployment in the denom specified in the denom column
   * Remaining balance based on deposits and MsgWithdrawLease
   */
  @Required @Column(DataTypes.DOUBLE) balance: number;
  /**
   * The deposit of the deployment in the denom specified in the denom column
   * Deposited amount based on MsgCreateDeployment and MsgDepositDeployment
   */
  @Required @Column(DataTypes.BIGINT) deposit: number;
  /**
   * The denom of the deployment
   * This can be uakt or uusdc
   */
  @Required @Column denom: string;
  /**
   * Last block height where an account settlement occurred. This happens on create, withdraw and close.
   * This is used to calculate the predicted closed height of the deployment and account settlement.
   */
  @Column lastWithdrawHeight?: number;
  /**
   * Withdrawn amount as of now. Updated on account settlement (create lease MsgCreateLease, withdraw lease MsgWithdrawLease, close lease MsgCloseLease).
   */
  @Required @Column(DataTypes.DOUBLE) withdrawnAmount!: number;
  /**
   * Block height the deployment got closed on-chain. Can happen from MsgCloseDeployment or as a side-effect through transaction events of having no active leases remaining.
   */
  @Column closedHeight?: number;
  /**
   * The block at which the deployment was created
   */
  @BelongsTo(() => Block, "createdHeight") createdBlock: Block;
  /**
   * The block at which the deployment was closed
   */
  @BelongsTo(() => Block, "closedHeight") closedBlock: Block;
  /**
   * The deployment groups associated with the deployment
   */
  @HasMany(() => DeploymentGroup, "deploymentId") deploymentGroups: DeploymentGroup[];
  /**
   * The leases associated with the deployment
   */
  @HasMany(() => Lease, "deploymentId") leases: Lease[];
  /**
   * The messages associated with the deployment
   */
  @HasMany(() => Message, { foreignKey: "relatedDeploymentId", constraints: false }) relatedMessages: Message[];
}
