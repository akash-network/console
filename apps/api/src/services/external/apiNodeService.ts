import { Validator } from "@akashnetwork/database/dbSchemas/base";
import axios from "axios";
import { Op } from "sequelize";

import { getTransactionByAddress } from "@src/services/db/transactionsService";
import type {
  CosmosGovProposalResponse,
  CosmosGovProposalsResponse,
  RestCosmosBankBalancesResponse,
  RestCosmosDistributionDelegatorsRewardsResponse,
  RestCosmosStakingDelegationsResponse,
  RestCosmosStakingDelegatorsRedelegationsResponse,
  RestCosmosStakingValidatorsResponse,
  RestGovProposalsTallyResponse
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

export async function getValidators() {
  const response = await axios.get<RestCosmosStakingValidatorsResponse>(
    `${apiNodeUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`
  );

  const validators = response.data.validators.map(x => ({
    operatorAddress: x.operator_address,
    moniker: x.description.moniker.trim(),
    votingPower: parseInt(x.tokens),
    commission: parseFloat(x.commission.commission_rates.rate),
    identity: x.description.identity
  }));

  const totalVotingPower = validators.reduce((acc, cur) => acc + cur.votingPower, 0);

  const validatorsFromDb = await Validator.findAll({
    where: {
      keybaseAvatarUrl: { [Op.not]: null, [Op.ne]: "" }
    }
  });

  const sortedValidators = validators
    .sort((a, b) => b.votingPower - a.votingPower)
    .map((x, i) => ({
      ...x,
      votingPowerRatio: x.votingPower / totalVotingPower,
      rank: i + 1,
      keybaseAvatarUrl: validatorsFromDb.find(y => y.operatorAddress === x.operatorAddress)?.keybaseAvatarUrl
    }));

  return sortedValidators;
}

export async function getValidator(address: string) {
  const response = await fetch(`${apiNodeUrl}/cosmos/staking/v1beta1/validators/${address}`);

  if (response.status === 404) {
    return null;
  }

  const data = (await response.json()) as any;

  const validatorsResponse = await axios.get<RestCosmosStakingValidatorsResponse>(
    `${apiNodeUrl}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED&pagination.limit=1000`
  );

  const validatorFromDb = await Validator.findOne({ where: { operatorAddress: address } });
  const validatorRank = validatorsResponse.data.validators
    .map(x => {
      return { votingPower: parseInt(x.tokens), address: x.operator_address };
    })
    .sort((a, b) => b.votingPower - a.votingPower)
    .findIndex(x => x.address === address);

  return {
    operatorAddress: data.validator.operator_address,
    address: validatorFromDb?.accountAddress,
    moniker: data.validator.description.moniker,
    keybaseUsername: validatorFromDb?.keybaseUsername,
    keybaseAvatarUrl: validatorFromDb?.keybaseAvatarUrl,
    votingPower: parseInt(data.validator.tokens),
    commission: parseFloat(data.validator.commission.commission_rates.rate),
    maxCommission: parseFloat(data.validator.commission.commission_rates.max_rate),
    maxCommissionChange: parseFloat(data.validator.commission.commission_rates.max_change_rate),
    identity: data.validator.description.identity,
    description: data.validator.description.details,
    website: data.validator.description.website,
    rank: validatorRank + 1
  };
}

export async function getProposals() {
  const response = await axios.get<CosmosGovProposalsResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals?pagination.limit=1000`);

  const proposals = response.data.proposals.map(x => ({
    id: parseInt(x.proposal_id),
    title: x.content.title,
    status: x.status,
    submitTime: x.submit_time,
    votingStartTime: x.voting_start_time,
    votingEndTime: x.voting_end_time,
    totalDeposit: parseInt(x.total_deposit[0].amount)
  }));

  const sortedProposals = proposals.sort((a, b) => b.id - a.id);

  return sortedProposals;
}

export async function getProposal(id: number) {
  try {
    const { data } = await axios.get<CosmosGovProposalResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals/${id}`);

    // const proposer = null; // TODO: Fix
    // if (id > 3) {
    //   const proposerResponse = await fetch(`${apiNodeUrl}/gov/proposals/${id}/proposer`);
    //   const proposerData = await proposerResponse.json();
    //   const validatorFromDb = await Validator.findOne({ where: { accountAddress: proposerData.result.proposer } });
    //   proposer = {
    //     address: proposer,
    //     moniker: validatorFromDb?.moniker,
    //     operatorAddress: validatorFromDb?.operatorAddress,
    //     avatarUrl: validatorFromDb?.keybaseAvatarUrl
    //   };
    // }

    let tally = null;

    if (data.proposal.status === "PROPOSAL_STATUS_VOTING_PERIOD") {
      const { data: tallyData } = await axios.get<RestGovProposalsTallyResponse>(`${apiNodeUrl}/cosmos/gov/v1beta1/proposals/${id}/tally`);

      tally = {
        yes: parseInt(tallyData.tally.yes) || 0,
        abstain: parseInt(tallyData.tally.abstain) || 0,
        no: parseInt(tallyData.tally.no) || 0,
        noWithVeto: parseInt(tallyData.tally.no_with_veto) || 0
      };
    } else {
      tally = {
        yes: parseInt(data.proposal.final_tally_result?.yes || "0") || 0,
        abstain: parseInt(data.proposal.final_tally_result?.abstain || "0") || 0,
        no: parseInt(data.proposal.final_tally_result?.no || "0") || 0,
        noWithVeto: parseInt(data.proposal.final_tally_result?.no_with_veto || "0") || 0
      };
    }

    return {
      id: parseInt(data.proposal.proposal_id),
      title: data.proposal.content.title,
      description: data.proposal.content.description,
      status: data.proposal.status,
      submitTime: data.proposal.submit_time,
      votingStartTime: data.proposal.voting_start_time,
      votingEndTime: data.proposal.voting_end_time,
      totalDeposit: parseInt(data.proposal.total_deposit[0].amount),
      //proposer: proposer,
      tally: { ...tally, total: tally.yes + tally.abstain + tally.no + tally.noWithVeto },
      paramChanges: (data.proposal.content.changes || []).map(change => ({
        subspace: change.subspace,
        key: change.key,
        value: JSON.parse(change.value)
      }))
    };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    } else {
      throw err;
    }
  }
}
