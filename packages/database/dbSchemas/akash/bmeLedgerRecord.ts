import { DataTypes, UUIDV4 } from "sequelize";
import { Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

/**
 * BmeLedgerRecord model
 *
 * Stores every BME mint/burn execution from EventLedgerRecordExecuted events.
 * Records come from both tx-level events (immediate execution) and block-level events (epoch-triggered).
 * Includes burned/minted amounts with denominations, oracle prices at execution time, and remint credit data.
 *
 * Proto: akash.bme.v1.EventLedgerRecordExecuted
 */
@Table({
  tableName: "bme_ledger_record",
  underscored: true,
  indexes: [
    { unique: false, fields: ["height"] },
    { unique: false, fields: ["burned_denom", "height"] },
    { unique: false, fields: ["minted_denom", "height"] }
  ]
})
export class BmeLedgerRecord extends Model {
  @Required @PrimaryKey @Default(UUIDV4) @Column(DataTypes.UUID) id!: string;
  @Required @Column height!: number;
  @Column sequence?: number;
  @Required @Column burnedFrom!: string;
  @Required @Column mintedTo!: string;
  @Column burnedDenom?: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) burnedAmount!: string;
  @Column(DataTypes.DECIMAL(20, 10)) burnedPrice?: string;
  @Column mintedDenom?: string;
  @Required @Column(DataTypes.DECIMAL(30, 0)) mintedAmount!: string;
  @Column(DataTypes.DECIMAL(20, 10)) mintedPrice?: string;
  @Column(DataTypes.DECIMAL(30, 0)) remintCreditIssuedAmount?: string;
  @Column(DataTypes.DECIMAL(30, 0)) remintCreditAccruedAmount?: string;
}
