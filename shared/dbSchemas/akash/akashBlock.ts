import { Column, Table } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Block } from "../base";
import { tableConfig } from "../base/block";

@Table({
  ...tableConfig,
  indexes: [...tableConfig.indexes, { name: "block_totaluusdspent_is_null", unique: false, fields: ["height"], where: { totalUUsdSpent: null } }]
})
export class AkashBlock extends Block {
  @Column(DataTypes.DOUBLE) totalUAktSpent?: number;
  @Column(DataTypes.DOUBLE) totalUUsdcSpent?: number;
  @Column(DataTypes.DOUBLE) totalUUsdSpent?: number;
  @Column activeLeaseCount?: number;
  @Column totalLeaseCount?: number;
  @Column activeCPU?: number;
  @Column activeGPU?: number;
  @Column(DataTypes.BIGINT) activeMemory?: number;
  @Column(DataTypes.BIGINT) activeEphemeralStorage?: number;
  @Column(DataTypes.BIGINT) activePersistentStorage?: number;
  @Column activeProviderCount?: number;
}
