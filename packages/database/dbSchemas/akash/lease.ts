import { DataTypes } from "sequelize";
import { BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Block } from "../base";
import { Required } from "../decorators/requiredDecorator";
import { Deployment } from "./deployment";
import { DeploymentGroup } from "./deploymentGroup";
import { Provider } from "./provider";

/**
 * Lease model for Akash
 *
 * A Lease is a lease that is associated with a deployment. (MsgCreateLease)
 * It is created after a deployment is created and is used to track the leases made with the associated provider.
 * A lease is created for each provider in the deployment group.
 */
@Table({
  modelName: "lease",
  indexes: [
    { unique: false, fields: ["closedHeight"] },
    { unique: false, fields: ["predictedClosedHeight"] },
    { unique: false, fields: ["deploymentId"] },
    { unique: true, fields: ["owner", "dseq", "gseq", "oseq", "providerAddress"] },
    { unique: false, fields: ["providerAddress", "closedHeight", "createdHeight"] }
  ]
})
export class Lease extends Model {
  /**
   * The unique identifier for the database lease
   */
  @Required @PrimaryKey @Default(DataTypes.UUIDV4) @Column(DataTypes.UUID) id!: string;
  /**
   * The unique identifier for the database deployment
   */
  @Required @Column(DataTypes.UUID) deploymentId!: string;
  /**
   * The unique identifier for the database deployment group
   */
  @Required @Column(DataTypes.UUID) deploymentGroupId!: string;
  /**
   * The owner address of the lease
   */
  @Required @Column owner!: string;
  /**
   * The dseq of the deployment
   */
  @Required @Column dseq!: string;
  /**
   * The oseq of the lease (Order Sequence Number)
   * Akash OSEQ distinguishes multiple orders associated with a single deployment.
   * Typically, Akash deployments use OSEQ=1 with only a single order associated with the deployment.
   * OSEQ is incremented when a lease associated with an existing deployment is closed, and a new order is generated.
   */
  @Required @Column oseq!: number;
  /**
   * The gseq of the lease (Group Sequence Number)
   * Akash GSEQ distinguishes “groups” of containers in a deployment, allowing each group to be leased independently. Orders, bids, and leases all act on a single group.
   * Typically, Akash deployments use GSEQ=1, with all pods associated with the deployment using a single provider.
   */
  @Required @Column gseq!: number;
  /**
   * The provider address of the lease
   */
  @Required @Column providerAddress!: string;
  /**
   * The block height at which the lease was created. Happens when a bid is accepted with MsgCreateLease.
   */
  @Required @Column createdHeight!: number;
  /**
   * Block height at which the lease is closed on-chain. Happens from MsgCloseLease, MsgCloseHeight or if the deployment become overdrawn during an account settlement.
   * It can also happen during transaction events when an authz is revoked for the wallet owning the lease.
   */
  @Column closedHeight?: number;
  /**
   * Block height at which the lease should theoretically expire. This is calculated based on the balance and price with the indexer.
   * It will usually not match the closedHeight since leases can be closed early (MsgCloseLease & MsgCloseBid) or closed late since the closing wont happen until the provider does a MsgWithdrawLease.
   */
  @Required @Column(DataTypes.DECIMAL(30, 0)) predictedClosedHeight!: string;
  /**
   * The price per block of the lease in the denom specified in the denom column (uakt or uusd)
   */
  @Required @Column(DataTypes.DOUBLE) price!: number;
  /**
   * Withdrawn amount as of now for this lease. Updated on account settlement (MsgWithdrawLease, MsgWithdrawLease, MsgCloseLease).
   */
  @Required @Default(0) @Column(DataTypes.DOUBLE) withdrawnAmount!: number;
  /**
   * The denom of the lease
   * This can be uakt or uusdc
   */
  @Required @Column denom!: string;

  // Stats
  /**
   * The cpu units of the lease in thousandths of a CPU
   * 1000 CPU units = 1 CPU
   */
  @Required @Column cpuUnits!: number;
  /**
   * The gpu units of the lease
   * 1 GPU unit = 1 GPU
   */
  @Required @Column gpuUnits!: number;
  /**
   * The memory quantity of the lease in bytes
   */
  @Required @Column(DataTypes.BIGINT) memoryQuantity!: number;
  /**
   * The ephemeral storage quantity of the lease in bytes
   */
  @Required @Column(DataTypes.BIGINT) ephemeralStorageQuantity!: number;
  /**
   * The persistent storage quantity of the lease in bytes
   */
  @Required @Column(DataTypes.BIGINT) persistentStorageQuantity!: number;

  /**
   * The block at which the lease was created
   */
  @BelongsTo(() => Block, "createdHeight") createdBlock!: Block;
  /**
   * The block at which the lease was closed
   */
  @BelongsTo(() => Block, "closedHeight") closedBlock!: Block;
  /**
   * The deployment group associated with the lease
   */
  @BelongsTo(() => DeploymentGroup, "deploymentGroupId") deploymentGroup!: DeploymentGroup;
  /**
   * The deployment associated with the lease
   */
  @BelongsTo(() => Deployment, "deploymentId") deployment!: Deployment;
  /**
   * The provider associated with the lease
   */
  @BelongsTo(() => Provider, "providerAddress") provider!: Provider;
}
