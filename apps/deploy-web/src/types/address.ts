import type { paths } from "@akashnetwork/console-api-types";

import type { TransactionDetail } from "./transaction";
import type { IValidatorAddess } from "./validator";

export interface AddressDetail {
  total: number;
  available: number;
  delegated: number;
  rewards: number;
  commission: number;
  assets: AssetDetail[];
  delegations: IDelegationDetail[];
  redelegations: IRedelegationDetail[];
  latestTransactions: TransactionDetail[];
}

export interface IDelegationDetail {
  validator: IValidatorAddess;
  amount: number;
  reward: number;
}

export interface IRedelegationDetail {
  srcAddress: IValidatorAddess;
  dstAddress: IValidatorAddess;
  creationHeight: number;
  completionTime: string;
  amount: number;
}

export interface AssetDetail {
  symbol: string;
  description?: string;
  logoUrl?: string;
  ibcToken?: string;
  amount: number;
}

type WalletBalances = paths["/v1/wallet-balances"]["get"]["responses"][200]["content"]["application/json"]["data"];

export type EscrowedDeploymentBalance = WalletBalances["activeDeployments"][number];

export interface Balances {
  balanceUAKT: number;
  balanceUUSDC: number;
  balanceUACT: number;
  deploymentEscrowUAKT: number;
  deploymentEscrowUUSDC: number;
  deploymentEscrowUACT: number;
  deploymentGrantsUAKT: number;
  deploymentGrantsUUSDC: number;
  deploymentGrantsUACT: number;
  activeDeployments: EscrowedDeploymentBalance[];
  deploymentGrants: WalletBalances["deploymentGrants"];
}
