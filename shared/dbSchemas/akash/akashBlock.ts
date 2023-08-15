import { Column } from "sequelize-typescript";
import { DataTypes } from "sequelize";
import { Block } from "../base";

export class AkashBlock extends Block {
  @Column(DataTypes.DOUBLE) totalUAktSpent?: number;
  @Column activeLeaseCount?: number;
  @Column totalLeaseCount?: number;
  @Column activeCPU?: number;
  @Column activeGPU?: number;
  @Column(DataTypes.BIGINT) activeMemory?: number;
  @Column(DataTypes.BIGINT) activeEphemeralStorage?: number;
  @Column(DataTypes.BIGINT) activePersistentStorage?: number;
  @Column activeProviderCount?: number;
}
