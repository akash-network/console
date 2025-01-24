import { DataTypes } from "sequelize";
import { Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * Bid model for Akash
 *
 * Bids are created when a provider makes a bid for a deployment.
 * When a bid is accepted by the deployment owner, a lease is created with the same dseq, gseq, oseq, and provider.
 * This is a 1:1 with the blockchain MsgCreateBid message.
 */
@Table({
  modelName: "bid",
  indexes: [{ unique: false, fields: ["owner", "dseq", "gseq", "oseq", "provider"] }]
})
export class Bid extends Model {
  /**
   * The owner of the deployment that this bid is for
   */
  @Required @Column owner: string;
  /**
   * The dseq of the deployment that this bid is for
   */
  @Required @Column dseq: string;
  /**
   * The gseq of the deployment that this bid is for
   */
  @Required @Column gseq: number;
  /**
   * The oseq of the deployment that this bid is for
   */
  @Required @Column oseq: number;
  /**
   * The provider address that made the bid
   */
  @Required @Column provider: string;
  /**
   * The price of the bid in uakt per block
   */
  @Required @Column(DataTypes.DOUBLE) price: number;
  /**
   * The block height at which the bid was created (MsgCreateBid)
   */
  @Required @Column createdHeight: number;
}
