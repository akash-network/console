import { DataTypes } from "sequelize";
import { BelongsTo, Column, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";
import { Provider } from "./provider"; // eslint-disable-line import-x/no-cycle

@Table({
  tableName: "provider_maintenance",
  underscored: true,
  indexes: [{ fields: ["provider", "status"] }, { fields: ["starts_at", "expected_ends_at"] }]
})
export class ProviderMaintenance extends Model {
  @Required @PrimaryKey @Column provider!: string;
  @Required @PrimaryKey @Column(DataTypes.DECIMAL(20, 0)) id!: string;
  @Required @Column maintenanceType!: number;
  @Required @Column(DataTypes.DATE) startsAt!: Date;
  @Required @Column(DataTypes.DATE) expectedEndsAt!: Date;
  @Required @Column(DataTypes.DATE) openedAt!: Date;
  @Column(DataTypes.DATE) closedAt?: Date;
  @Column(DataTypes.BLOB) metadataHash?: Buffer;
  @Required @Column status!: number;
  @Required @Column observedHeight!: number;
  @Required @Column(DataTypes.DATE) observedBlockTime!: Date;

  @BelongsTo(() => Provider, { foreignKey: "provider", targetKey: "owner", constraints: false }) providerRecord!: Provider;
}
