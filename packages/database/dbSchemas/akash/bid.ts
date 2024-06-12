import { DataTypes } from "sequelize";
import { Column, Model, Table } from "sequelize-typescript";

import { Required } from "../decorators/requiredDecorator";

@Table({
  modelName: "bid",
  indexes: [{ unique: false, fields: ["owner", "dseq", "gseq", "oseq", "provider"] }]
})
export class Bid extends Model {
  @Required @Column owner: string;
  @Required @Column dseq: string;
  @Required @Column gseq: number;
  @Required @Column oseq: number;
  @Required @Column provider: string;
  @Required @Column(DataTypes.DOUBLE) price: number;
  @Required @Column createdHeight: number;
}
