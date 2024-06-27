import { DataTypes, UUIDV4 } from "sequelize";
import { AllowNull, Column, Default, Model, PrimaryKey, Table } from "sequelize-typescript";

export interface UserWallet {
  id: string;
  address: string;
  cert: string;
  certKey: string;
  stripeCustomerId: string;
  creditAmount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Table({
  modelName: "user_wallet"
})
export class UserWalletModel extends Model<UserWallet> implements Omit<UserWalletModel, "createdAt" | "updatedAt"> {
  @AllowNull(false)
  @PrimaryKey
  @Default(UUIDV4)
  @Column(DataTypes.UUID)
  id: string;

  @AllowNull(false)
  @Column(DataTypes.STRING)
  address: string;

  @AllowNull(false)
  @Column(DataTypes.STRING)
  stripeCustomerId: string;

  @AllowNull(false)
  @Column(DataTypes.DECIMAL(10, 2))
  @Default(0.0)
  creditAmount: number;
}
