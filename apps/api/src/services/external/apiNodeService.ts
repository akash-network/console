import { Validator } from "@akashnetwork/database/dbSchemas/base";
import axios from "axios";

import { getTransactionByAddress } from "@src/services/db/transactionsService";
import type {
  RestCosmosBankBalancesResponse,
  RestCosmosDistributionDelegatorsRewardsResponse,
  RestCosmosStakingDelegationsResponse,
  RestCosmosStakingDelegatorsRedelegationsResponse
} from "@src/types/rest";
import type { CosmosDistributionValidatorsCommissionResponse } from "@src/types/rest/cosmosDistributionValidatorsCommissionResponse";
import { coinToAsset } from "@src/utils/coin";
import { apiNodeUrl } from "@src/utils/constants";

export async function getAddressBalance(address: string) {
  const balancesQuery = axios.get<RestCosmosBankBalancesResponse>(`${apiNodeUrl}/cosmos/bank/v1beta1/balances/${address}?pagination.limit=1000`);
  const delegationsQuery = axios.get<RestCosmosStakingDelegationsResponse>(`${apiNodeUrl}/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=1000`);
  const rewardsQuery = axios.get<RestCosmosDistributionDelegatorsRewardsResponse>(`${apiNodeUrl}/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
  const redelegationsQuery = axios.get<RestCosmosStakingDelegatorsRedelegationsResponse>(
    `${apiNodeUrl}/cosmos/staking/v1beta1/delegators/${address}/redelegations?pagination.limit=1000`
  );
  const latestTransactionsQuery = getTransactionByAddress(address, 0, 5);

  const [balancesResponse, delegationsResponse, rewardsResponse, redelegationsResponse, latestTransactions] = await Promise.all([
    balancesQuery,
    delegationsQuery,
    rewardsQuery,
    redelegationsQuery,
    latestTransactionsQuery
  ]);

  const validatorsFromDb = await Validator.findAll();
  const validatorFromDb = validatorsFromDb.find(v => v.accountAddress === address);
  let commission = 0;

  if (validatorFromDb?.operatorAddress) {
    const commissionData = await axios.get<CosmosDistributionValidatorsCommissionResponse>(
      `${apiNodeUrl}/cosmos/distribution/v1beta1/validators/${validatorFromDb.operatorAddress}/commission`
    );
    const coin = commissionData.data.commission.commission.find(x => x.denom === "uakt");
    commission = coin ? parseFloat(coin.amount) : 0;
  }

  const assets = balancesResponse.data.balances.map(b => coinToAsset(b));
  const delegations = delegationsResponse.data.delegation_responses.map(x => {
    const validator = validatorsFromDb.find(v => v.operatorAddress === x.delegation.validator_address);

    return {
      validator: {
        address: validator?.accountAddress,
        moniker: validator?.moniker,
        operatorAddress: validator?.operatorAddress,
        avatarUrl: validator?.keybaseAvatarUrl
      },
      amount: parseInt(x.balance.amount),
      reward: null as number | null
    };
  });

  for (const reward of rewardsResponse.data.rewards) {
    const delegation = delegations.find(x => x.validator.operatorAddress === reward.validator_address);
    const rewardAmount = reward.reward.length > 0 ? parseFloat(reward.reward.find(x => x.denom === "uakt")?.amount || "0") : 0;

    if (delegation) {
      delegation.reward = rewardAmount;
    } else {
      const validator = validatorsFromDb.find(v => v.operatorAddress === reward.validator_address);
      delegations.push({
        validator: {
          address: validator?.accountAddress,
          moniker: validator?.moniker,
          operatorAddress: validator?.operatorAddress,
          avatarUrl: validator?.keybaseAvatarUrl
        },
        amount: 0,
        reward: rewardAmount
      });
    }
  }

  const available = balancesResponse.data.balances.filter(x => x.denom === "uakt").reduce((acc, cur) => acc + parseInt(cur.amount), 0);
  const delegated = delegations.reduce((acc, cur) => acc + cur.amount, 0);
  const rewards = rewardsResponse.data.total.length > 0 ? parseInt(rewardsResponse.data.total.find(x => x.denom === "uakt")?.amount || "0") : 0;
  const redelegations = redelegationsResponse.data.redelegation_responses.map(x => {
    const srcValidator = validatorsFromDb.find(v => v.operatorAddress === x.redelegation.validator_src_address);
    const destValidator = validatorsFromDb.find(v => v.operatorAddress === x.redelegation.validator_dst_address);

    return {
      srcAddress: {
        address: srcValidator?.accountAddress,
        moniker: srcValidator?.moniker,
        operatorAddress: srcValidator?.operatorAddress,
        avatarUrl: srcValidator?.keybaseAvatarUrl
      },
      dstAddress: {
        address: destValidator?.accountAddress,
        moniker: destValidator?.moniker,
        operatorAddress: destValidator?.operatorAddress,
        avatarUrl: destValidator?.keybaseAvatarUrl
      },
      creationHeight: x.entries[0].redelegation_entry.creation_height,
      completionTime: x.entries[0].redelegation_entry.completion_time,
      amount: parseInt(x.entries[0].balance)
    };
  });

  const total = available + delegated + rewards + commission;

  return {
    total: total,
    delegations,
    available,
    delegated,
    rewards,
    assets,
    redelegations,
    commission,
    latestTransactions: latestTransactions.results
  };
}
