import { RestApiAuthzGrantsResponseType } from "./balances";
import { DeploymentDto } from "./deployment";
import { TransactionDetail } from "./transaction";
import { IValidatorAddess } from "./validator";

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

export interface Balances {
  balanceUAKT: number;
  balanceUUSDC: number;
  deploymentEscrowUAKT: number;
  deploymentEscrowUUSDC: number;
  deploymentGrantsUAKT: number;
  deploymentGrantsUUSDC: number;
  activeDeployments: DeploymentDto[];
  deploymentGrants: RestApiAuthzGrantsResponseType;
}
