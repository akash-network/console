import { Block } from "@akashnetwork/database/dbSchemas";
import { Deployment, Lease, Provider, ProviderAttribute } from "@akashnetwork/database/dbSchemas/akash";
import { Validator } from "@akashnetwork/database/dbSchemas/base";
import axios from "axios";
import fetch from "node-fetch";
import { Op } from "sequelize";

import { cacheKeys, cacheResponse } from "@src/caching/helpers";
import { LoggerService } from "@src/core/services/logger/logger.service";
import { getTransactionByAddress } from "@src/services/db/transactionsService";
import {
  CosmosGovProposalResponse,
  CosmosGovProposalsResponse,
  RestAkashDeploymentListResponse,
  RestAkasheploymentInfoResponse,
  RestAkashLeaseListResponse,
  RestCosmosBankBalancesResponse,
  RestCosmosDistributionDelegatorsRewardsResponse,
  RestCosmosStakingDelegationsResponse,
  RestCosmosStakingDelegatorsRedelegationsResponse,
  RestCosmosStakingValidatorsResponse,
  RestGovProposalsTallyResponse
} from "@src/types/rest";
import { CosmosBankSupplyResponse } from "@src/types/rest/cosmosBankSupplyResponse";
import { CosmosDistributionCommunityPoolResponse } from "@src/types/rest/cosmosDistributionCommunityPoolResponse";
import { CosmosDistributionParamsResponse } from "@src/types/rest/cosmosDistributionParamsResponse";
import { CosmosDistributionValidatorsCommissionResponse } from "@src/types/rest/cosmosDistributionValidatorsCommissionResponse";
import { CosmosMintInflationResponse } from "@src/types/rest/cosmosMintInflationResponse";
import { CosmosStakingPoolResponse } from "@src/types/rest/cosmosStakingPoolResponse";
import { coinToAsset } from "@src/utils/coin";
import { apiNodeUrl, averageBlockCountInAMonth, betaTypeVersion, betaTypeVersionMarket } from "@src/utils/constants";
import { createLoggingExecutor } from "@src/utils/logging";
import { getDeploymentRelatedMessages } from "../db/deploymentService";
import { getProviderList } from "../db/providerStatusService";

export async function getChainStats() {
  const logger = new LoggerService({ context: "ApiNode" })
  const runOrLog = createLoggingExecutor(logger)

  const result = await cacheResponse(
    60 * 5, // 5 minutes
    cacheKeys.getChainStats,
    async () => {
      const bondedTokensAsPromised = await runOrLog(async () => {
        const bondedTokensQuery = await axios.get<CosmosStakingPoolResponse>(
          `${apiNodeUrl}/cosmos/staking/v1beta1/pool`
        );
        return parseInt(bondedTokensQuery.data.pool.bonded_tokens);
      });

      const totalSupplyAsPromised = await runOrLog(async () => {
        const supplyQuery = await axios.get<CosmosBankSupplyResponse>(
          `${apiNodeUrl}/cosmos/bank/v1beta1/supply?pagination.limit=1000`
        );
        return parseInt(
          supplyQuery.data.supply.find((x) => x.denom === "uakt")?.amount || "0"
        );
      });

      const communityPoolAsPromised = await runOrLog(async () => {
        const communityPoolQuery = await axios.get<CosmosDistributionCommunityPoolResponse>(
          `${apiNodeUrl}/cosmos/distribution/v1beta1/community_pool`
        );
        return parseFloat(
          communityPoolQuery.data.pool.find((x) => x.denom === "uakt")?.amount || "0"
        );
      });

      const inflationAsPromised = await runOrLog(async () => {
        const inflationQuery = await axios.get<CosmosMintInflationResponse>(
          `${apiNodeUrl}/cosmos/mint/v1beta1/inflation`
        );
        return parseFloat(inflationQuery.data.inflation || "0");
      });

      const communityTaxAsPromised = await runOrLog(async () => {
        const distributionQuery = await axios.get<CosmosDistributionParamsResponse>(
          `${apiNodeUrl}/cosmos/distribution/v1beta1/params`
        );
        return parseFloat(distributionQuery.data.params.community_tax || "0");
      });

      const [bondedTokens, totalSupply, communityPool, inflation, communityTax] = await Promise.all([
        bondedTokensAsPromised,
        totalSupplyAsPromised,
        communityPoolAsPromised,
        inflationAsPromised,
        communityTaxAsPromised
      ]);

      return {
        communityPool,
        inflation,
        communityTax,
        bondedTokens,
        totalSupply,
      };
    },
    true
  );

  let stakingAPR: number | undefined;
  if (result.bondedTokens && result.bondedTokens > 0 && result.inflation && result.communityTax && result.totalSupply) {
    stakingAPR = result.inflation * (1 - result.communityTax) * result.totalSupply / result.bondedTokens
  }

  return {
    bondedTokens: result.bondedTokens,
    totalSupply: result.totalSupply,
    communityPool: result.communityPool,
    inflation: result.inflation,
    stakingAPR,
  };
}

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
        address: validator.accountAddress,
        moniker: validator?.moniker,
        operatorAddress: validator?.operatorAddress,
        avatarUrl: validator?.keybaseAvatarUrl
      },
      amount: parseInt(x.balance.amount),
      reward: null
    };
  });

  for (const reward of rewardsResponse.data.rewards) {
    const delegation = delegations.find(x => x.validator.operatorAddress === reward.validator_address);
    const rewardAmount = reward.reward.length > 0 ? parseFloat(reward.reward.find(x => x.denom === "uakt").amount) : 0;

    if (delegation) {
      delegation.reward = rewardAmount;
    } else {
      const validator = validatorsFromDb.find(v => v.operatorAddress === reward.validator_address);
      delegations.push({
        validator: {
          address: validator.accountAddress,
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
  const rewards = rewardsResponse.data.total.length > 0 ? parseInt(rewardsResponse.data.total.find(x => x.denom === "uakt").amount) : 0;
  const redelegations = redelegationsResponse.data.redelegation_responses.map(x => {
    const srcValidator = validatorsFromDb.find(v => v.operatorAddress === x.redelegation.validator_src_address);
    const destValidator = validatorsFromDb.find(v => v.operatorAddress === x.redelegation.validator_dst_address);

    return {
      srcAddress: {
        address: srcValidator.accountAddress,
        moniker: srcValidator?.moniker,
        operatorAddress: srcValidator?.operatorAddress,
        avatarUrl: srcValidator?.keybaseAvatarUrl
      },
      dstAddress: {
        address: destValidator.accountAddress,
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

  const data = await response.json();

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
        yes: parseInt(data.proposal.final_tally_result.yes) || 0,
        abstain: parseInt(data.proposal.final_tally_result.abstain) || 0,
        no: parseInt(data.proposal.final_tally_result.no) || 0,
        noWithVeto: parseInt(data.proposal.final_tally_result.no_with_veto) || 0
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

export async function getDeployment(owner: string, dseq: string) {
  const deploymentQuery = fetch(`${apiNodeUrl}/akash/deployment/${betaTypeVersion}/deployments/info?id.owner=${owner}&id.dseq=${dseq}`);
  const leasesQuery = fetch(
    `${apiNodeUrl}/akash/market/${betaTypeVersionMarket}/leases/list?filters.owner=${owner}&filters.dseq=${dseq}&pagination.limit=1000`
  );
  const relatedMessagesQuery = getDeploymentRelatedMessages(owner, dseq);
  const dbDeploymentQuery = Deployment.findOne({
    attributes: ["createdHeight", "closedHeight"],
    where: { owner: owner, dseq: dseq },
    include: [
      { model: Block, attributes: ["datetime"], as: "createdBlock" },
      { model: Block, attributes: ["datetime"], as: "closedBlock" },
      {
        model: Lease,
        attributes: ["createdHeight", "closedHeight", "gseq", "oseq"],
        include: [
          { model: Block, attributes: ["datetime"], as: "createdBlock" },
          { model: Block, attributes: ["datetime"], as: "closedBlock" }
        ]
      }
    ]
  });

  const [deploymentResponse, leasesResponse, relatedMessages, dbDeployment] = await Promise.all([
    deploymentQuery,
    leasesQuery,
    relatedMessagesQuery,
    dbDeploymentQuery
  ]);

  if (deploymentResponse.status === 404) {
    return null;
  }

  const deploymentData = (await deploymentResponse.json()) as RestAkasheploymentInfoResponse;

  if ("code" in deploymentData) {
    if (deploymentData.message?.toLowerCase().includes("deployment not found")) {
      return null;
    } else {
      throw new Error(deploymentData.message);
    }
  }

  const leasesData = (await leasesResponse.json()) as RestAkashLeaseListResponse;

  const providerAddresses = leasesData.leases.map(x => x.lease.lease_id.provider);
  const providers = await Provider.findAll({
    where: {
      owner: {
        [Op.in]: providerAddresses
      }
    },
    include: [{ model: ProviderAttribute }]
  });
  const deploymentDenom = deploymentData.escrow_account.balance.denom;

  const leases = leasesData.leases.map(x => {
    const provider = providers.find(p => p.owner === x.lease.lease_id.provider);
    const group = deploymentData.groups.find(g => g.group_id.gseq === x.lease.lease_id.gseq);
    const dbLease = dbDeployment?.leases.find(l => l.gseq === x.lease.lease_id.gseq && l.oseq === x.lease.lease_id.oseq);

    return {
      gseq: x.lease.lease_id.gseq,
      oseq: x.lease.lease_id.oseq,
      createdHeight: dbLease?.createdHeight,
      createdDate: dbLease?.createdBlock?.datetime,
      closedHeight: dbLease?.closedHeight,
      closedDate: dbLease?.closedBlock?.datetime,
      provider: {
        address: provider.owner,
        hostUri: provider.hostUri,
        isDeleted: !!provider.deletedHeight,
        attributes: provider.providerAttributes.map(attr => ({
          key: attr.key,
          value: attr.value
        }))
      },
      status: x.lease.state,
      monthlyCostUDenom: Math.round(parseFloat(x.lease.price.amount) * averageBlockCountInAMonth),
      cpuUnits: group.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0),
      gpuUnits: group.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0),
      memoryQuantity: group.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0),
      storageQuantity: group.group_spec.resources
        .map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count)
        .reduce((a, b) => a + b, 0)
    };
  });

  return {
    owner: deploymentData.deployment.deployment_id.owner,
    dseq: deploymentData.deployment.deployment_id.dseq,
    balance: parseFloat(deploymentData.escrow_account.balance.amount),
    denom: deploymentDenom,
    status: deploymentData.deployment.state,
    createdHeight: dbDeployment?.createdHeight,
    createdDate: dbDeployment?.createdBlock?.datetime,
    closedHeight: dbDeployment?.closedHeight,
    closedDate: dbDeployment?.closedBlock?.datetime,
    totalMonthlyCostUDenom: leases.map(x => x.monthlyCostUDenom).reduce((a, b) => a + b, 0),
    leases: leases,
    events: relatedMessages || [],
    other: deploymentData
  };
}

export async function getAddressDeployments(owner: string, skip: number, limit: number, reverseSorting: boolean, filters: { status?: string } = {}) {
  const response = await axios.get<RestAkashDeploymentListResponse>(`${apiNodeUrl}/akash/deployment/${betaTypeVersion}/deployments/list`, {
    params: {
      "filters.owner": owner,
      "filters.state": filters.status,
      "pagination.offset": skip,
      "pagination.limit": limit,
      "pagination.count_total": true,
      "pagination.reverse": reverseSorting
    }
  });

  const leaseResponse = await axios.get<RestAkashLeaseListResponse>(`${apiNodeUrl}/akash/market/${betaTypeVersionMarket}/leases/list`, {
    params: {
      "filters.owner": owner,
      "filters.state": "active"
    }
  });
  const providers = await getProviderList();

  return {
    count: parseInt(response.data.pagination.total),
    results: response.data.deployments.map(x => ({
      owner: x.deployment.deployment_id.owner,
      dseq: x.deployment.deployment_id.dseq,
      status: x.deployment.state,
      createdHeight: parseInt(x.deployment.created_at),
      escrowAccount: x.escrow_account,
      cpuUnits: x.groups
        .map(g => g.group_spec.resources.map(r => parseInt(r.resource.cpu.units.val) * r.count).reduce((a, b) => a + b, 0))
        .reduce((a, b) => a + b, 0),
      gpuUnits: x.groups
        .map(g => g.group_spec.resources.map(r => parseInt(r.resource.gpu?.units?.val) * r.count || 0).reduce((a, b) => a + b, 0))
        .reduce((a, b) => a + b, 0),
      memoryQuantity: x.groups
        .map(g => g.group_spec.resources.map(r => parseInt(r.resource.memory.quantity.val) * r.count).reduce((a, b) => a + b, 0))
        .reduce((a, b) => a + b, 0),
      storageQuantity: x.groups
        .map(g =>
          g.group_spec.resources.map(r => r.resource.storage.map(s => parseInt(s.quantity.val)).reduce((a, b) => a + b, 0) * r.count).reduce((a, b) => a + b, 0)
        )
        .reduce((a, b) => a + b, 0),
      leases: leaseResponse.data.leases
        .filter(l => l.lease.lease_id.dseq === x.deployment.deployment_id.dseq)
        .map(lease => {
          const provider = providers.find(p => p.owner === lease.lease.lease_id.provider);
          return {
            id: lease.lease.lease_id.dseq + lease.lease.lease_id.gseq + lease.lease.lease_id.oseq,
            owner: lease.lease.lease_id.owner,
            provider: provider,
            dseq: lease.lease.lease_id.dseq,
            gseq: lease.lease.lease_id.gseq,
            oseq: lease.lease.lease_id.oseq,
            state: lease.lease.state,
            price: lease.lease.price
          };
        })
    }))
  };
}
