import { DataTypes } from "sequelize";
import { Column, Table } from "sequelize-typescript";

import { Block } from "../base";
import { tableConfig } from "../base/block";

/**
 * Custom Block model for Akash
 *
 * This model extends the base Block model and adds additional columns for Akash specific metrics updated by the indexer for every block.
 * It makes it easier to query for Akash specific metrics with the most precision.
 */
@Table({
  ...tableConfig,
  indexes: [...tableConfig.indexes, { name: "block_totaluusdspent_is_null", unique: false, fields: ["height"], where: { totalUUsdSpent: null } }]
})
export class AkashBlock extends Block {
  /**
   * Total amount of AKT spent at current block height in uakt
   */
  @Column(DataTypes.DOUBLE) totalUAktSpent?: number;
  /**
   * Total amount of USDC spent at current block height in uusdc
   */
  @Column(DataTypes.DOUBLE) totalUUsdcSpent?: number;
  /**
   * Total amount of USD spent at current block height in usd
   */
  @Column(DataTypes.DOUBLE) totalUUsdSpent?: number;
  /**
   * Total amount of active leases at current block height
   */
  @Column activeLeaseCount?: number;
  /**
   * Total amount of leases at current block height
   */
  @Column totalLeaseCount?: number;
  /**
   * Total amount of active CPU at current block height
   */
  @Column activeCPU?: number;
  /**
   * Total amount of active GPU at current block height
   */
  @Column activeGPU?: number;
  /**
   * Total amount of active memory at current block height in bytes
   */
  @Column(DataTypes.BIGINT) activeMemory?: number;
  /**
   * Total amount of active ephemeral storage at current block height in bytes
   */
  @Column(DataTypes.BIGINT) activeEphemeralStorage?: number;
  /**
   * Total amount of active persistent storage at current block height in bytes
   */
  @Column(DataTypes.BIGINT) activePersistentStorage?: number;
  /**
   * Total amount of active providers at current block height
   */
  @Column activeProviderCount?: number;
}
