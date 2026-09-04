import { DataTypes } from "sequelize";
import { AutoIncrement, BelongsTo, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider";

@Table({
  tableName: "verification_provider_tier_demotion",
  underscored: true,
  indexes: [{ fields: ["provider", "id"] }, { fields: ["observed_height"] }]
})
export class VerificationProviderTierDemotion extends Model {
  @Required @AutoIncrement @PrimaryKey @Column(DataTypes.BIGINT) id!: string;
  @Required @Column provider!: string;
  @Required @Column previousEffectiveTier!: number;
  @Required @Column previousMaxPlacementTier!: number;
  @Required @Column previousSnapshotState!: string;
  @Required @Column currentEffectiveTier!: number;
  @Required @Column currentMaxPlacementTier!: number;
  @Required @Column currentSnapshotState!: string;
  @Required @Column(DataTypes.ARRAY(DataTypes.STRING)) changes!: string[];
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;
  @Required @Default(DataTypes.NOW) @Column(DataTypes.DATE) createdAt!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
}
