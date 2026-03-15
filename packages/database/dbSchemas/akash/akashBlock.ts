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
   * Total amount of ACT spent at current block height in uact
   */
  @Column(DataTypes.DOUBLE) totalUActSpent?: number;
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
   * Total amount of active CPU in thousandths of a CPU at current block height
   * 1 CPU = 1000 thousandths of a CPU
   */
  @Column activeCPU?: number;
  /**
   * Total amount of active GPU at current block height
   * 1 GPU = 1 unit of a GPU
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
  /**
   * Cumulative uakt burned to mint ACT via BME
   */
  @Column(DataTypes.DOUBLE) totalAktBurnedForAct?: number;
  /**
   * Cumulative uact minted from AKT burns via BME
   */
  @Column(DataTypes.DOUBLE) totalActMinted?: number;
  /**
   * Cumulative uact burned to remint AKT via BME
   */
  @Column(DataTypes.DOUBLE) totalActBurnedForAkt?: number;
  /**
   * Cumulative uakt reminted from ACT burns via BME
   */
  @Column(DataTypes.DOUBLE) totalAktReminted?: number;
  /**
   * Cumulative remint credits issued via BME
   */
  @Column(DataTypes.DOUBLE) totalRemintCreditIssued?: number;
  /**
   * Cumulative remint credits used via BME
   */
  @Column(DataTypes.DOUBLE) totalRemintCreditAccrued?: number;
  /**
   * Absolute AKT held in BME vault as collateral (module account balance)
   */
  @Column(DataTypes.DOUBLE) vaultAkt?: number;
  /**
   * Total circulating supply of ACT
   */
  @Column(DataTypes.DOUBLE) outstandingAct?: number;
}
