import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "verification_provider_observation",
  underscored: true
})
export class VerificationProviderObservation extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;
  @Required @Column effectiveTier!: number;
  @Required @Column maxPlacementTier!: number;
  @Required @Column snapshotState!: string;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
}
