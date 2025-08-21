import { extractData } from "../http/http.service";
import type { HttpClient } from "../utils/httpClient";
import type {
  CosmosBankSupplyResponse,
  CosmosDistributionCommunityPoolResponse,
  CosmosDistributionParamsResponse,
  CosmosDistributionValidatorsCommissionResponse,
  CosmosGovProposalResponse,
  CosmosGovProposalsResponse,
  CosmosMintInflationResponse,
  CosmosStakingPoolResponse,
  RestCosmosBankBalancesResponse,
  RestCosmosDistributionDelegatorsRewardsResponse,
  RestCosmosStakingDelegationsResponse,
  RestCosmosStakingDelegatorsRedelegationsResponse,
  RestCosmosStakingValidatorListResponse,
  RestCosmosStakingValidatorResponse,
  RestGovProposalsTallyResponse
} from "./types";

export class CosmosHttpService {
  constructor(private readonly httpClient: HttpClient) {}

  async getStakingPool(): Promise<CosmosStakingPoolResponse["pool"]> {
    const response = extractData(await this.httpClient.get<CosmosStakingPoolResponse>(`/cosmos/staking/v1beta1/pool`));

    return response.pool;
  }

  async getBankSupply(): Promise<CosmosBankSupplyResponse["supply"]> {
    const response = extractData(await this.httpClient.get<CosmosBankSupplyResponse>(`/cosmos/bank/v1beta1/supply?pagination.limit=1000`));

    return response.supply;
  }

  async getCommunityPool(): Promise<CosmosDistributionCommunityPoolResponse["pool"]> {
    const response = extractData(await this.httpClient.get<CosmosDistributionCommunityPoolResponse>(`/cosmos/distribution/v1beta1/community_pool`));

    return response.pool;
  }

  async getInflation(): Promise<number> {
    const response = extractData(await this.httpClient.get<CosmosMintInflationResponse>(`/cosmos/mint/v1beta1/inflation`));

    return parseFloat(response.inflation || "0");
  }

  async getDistributionParams(): Promise<CosmosDistributionParamsResponse["params"]> {
    const response = extractData(await this.httpClient.get<CosmosDistributionParamsResponse>(`/cosmos/distribution/v1beta1/params`));

    return response.params;
  }

  async getValidatorList(): Promise<RestCosmosStakingValidatorListResponse> {
    return extractData(
      await this.httpClient.get<RestCosmosStakingValidatorListResponse>(`/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`)
    );
  }

  async getValidatorByAddress(address: string): Promise<RestCosmosStakingValidatorResponse> {
    return extractData(await this.httpClient.get<RestCosmosStakingValidatorResponse>(`/cosmos/staking/v1beta1/validators/${address}`));
  }

  async getBankBalancesByAddress(address: string): Promise<RestCosmosBankBalancesResponse> {
    return extractData(await this.httpClient.get<RestCosmosBankBalancesResponse>(`/cosmos/bank/v1beta1/balances/${address}?pagination.limit=1000`));
  }

  async getStakingDelegationsByAddress(address: string): Promise<RestCosmosStakingDelegationsResponse> {
    return extractData(await this.httpClient.get<RestCosmosStakingDelegationsResponse>(`/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=1000`));
  }

  async getDistributionDelegatorsRewardsByAddress(address: string): Promise<RestCosmosDistributionDelegatorsRewardsResponse> {
    return extractData(
      await this.httpClient.get<RestCosmosDistributionDelegatorsRewardsResponse>(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`)
    );
  }

  async getStakingDelegatorsRedelegationsByAddress(address: string): Promise<RestCosmosStakingDelegatorsRedelegationsResponse> {
    return extractData(
      await this.httpClient.get<RestCosmosStakingDelegatorsRedelegationsResponse>(
        `/cosmos/staking/v1beta1/delegators/${address}/redelegations?pagination.limit=1000`
      )
    );
  }

  async getDistributionValidatorsCommissionByAddress(address: string): Promise<CosmosDistributionValidatorsCommissionResponse> {
    return extractData(
      await this.httpClient.get<CosmosDistributionValidatorsCommissionResponse>(`/cosmos/distribution/v1beta1/validators/${address}/commission`)
    );
  }

  async getProposals(): Promise<CosmosGovProposalsResponse["proposals"]> {
    const { proposals } = extractData(await this.httpClient.get<CosmosGovProposalsResponse>(`/cosmos/gov/v1beta1/proposals?pagination.limit=1000`));

    return proposals;
  }

  async getProposal(id: number): Promise<CosmosGovProposalResponse["proposal"]> {
    const { proposal } = extractData(await this.httpClient.get<CosmosGovProposalResponse>(`/cosmos/gov/v1beta1/proposals/${id}`));

    return proposal;
  }

  async getProposalTally(id: number): Promise<RestGovProposalsTallyResponse["tally"]> {
    const { tally } = extractData(await this.httpClient.get<RestGovProposalsTallyResponse>(`/cosmos/gov/v1beta1/proposals/${id}/tally`));

    return tally;
  }
}
