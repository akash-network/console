import { Validator } from "@akashnetwork/database/dbSchemas/base";
import { CosmosHttpService } from "@akashnetwork/http-sdk/src/cosmos/cosmos-http.service";
import { LoggerService } from "@akashnetwork/logging";
import { asset_lists } from "@chain-registry/assets";
import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import { singleton } from "tsyringe";

import type { GetAddressResponse } from "@src/address/http-schemas/address.schema";
import { TransactionService } from "@src/transaction/services/transaction/transaction.service";

const logger = LoggerService.forContext("CoinUtil");

@singleton()
export class AddressService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly cosmosHttpService: CosmosHttpService
  ) {}

  async getAddressDetails(address: string): Promise<GetAddressResponse> {
    const [balancesResponse, delegationsResponse, rewardsResponse, redelegationsResponse, latestTransactions] = await Promise.all([
      this.cosmosHttpService.getBankBalancesByAddress(address),
      this.cosmosHttpService.getStakingDelegationsByAddress(address),
      this.cosmosHttpService.getDistributionDelegatorsRewardsByAddress(address),
      this.cosmosHttpService.getStakingDelegatorsRedelegationsByAddress(address),
      this.transactionService.getTransactionsByAddress({ address, skip: 0, limit: 5 })
    ]);

    const validatorsFromDb = await Validator.findAll();
    const validatorFromDb = validatorsFromDb.find(v => v.accountAddress === address);
    let commission = 0;

    if (validatorFromDb?.operatorAddress) {
      const commissionData = await this.cosmosHttpService.getDistributionValidatorsCommissionByAddress(validatorFromDb.operatorAddress);
      const coin = commissionData.commission.commission.find(x => x.denom === "uakt");
      commission = coin ? parseFloat(coin.amount) : 0;
    }

    const assets = balancesResponse.balances.map(b => this.coinToAsset(b));
    const delegations = delegationsResponse.delegation_responses.map(x => {
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

    for (const reward of rewardsResponse.rewards) {
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

    const available = balancesResponse.balances.filter(x => x.denom === "uakt").reduce((acc, cur) => acc + parseInt(cur.amount), 0);
    const delegated = delegations.reduce((acc, cur) => acc + cur.amount, 0);
    const rewards = rewardsResponse.total.length > 0 ? parseInt(rewardsResponse.total.find(x => x.denom === "uakt")?.amount || "0") : 0;
    const redelegations = redelegationsResponse.redelegation_responses.map(x => {
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

  private coinToAsset(coin: Coin) {
    if (coin.denom === "uakt") {
      return {
        symbol: "AKT",
        logoUrl: "https://console.akash.network/images/akash-logo.svg",
        amount: parseInt(coin.amount) / 1_000_000
      };
    } else if (coin.denom === "akt") {
      return {
        symbol: "AKT",
        logoUrl: "https://console.akash.network/images/akash-logo.svg",
        amount: parseFloat(coin.amount)
      };
    } else {
      const akashChain = asset_lists.find(c => c.chain_name === "akash");
      const ibcAsset = akashChain?.assets.find(a => a.base === coin.denom);

      if (!ibcAsset) {
        logger.info(`Unknown asset ${coin.denom}`);

        return {
          ibcToken: coin.denom,
          amount: parseFloat(coin.amount)
        };
      }

      const displayAsset = ibcAsset.denom_units.find(d => d.denom === ibcAsset.display);

      if (!displayAsset) {
        logger.info(`Unable to find display asset for ${coin.denom}`);

        return {
          ibcToken: coin.denom,
          amount: parseFloat(coin.amount)
        };
      }

      const displayAmount = parseInt(coin.amount) / Math.pow(10, displayAsset.exponent);

      return {
        symbol: ibcAsset.symbol,
        ibcToken: coin.denom,
        logoUrl: ibcAsset.logo_URIs?.svg || ibcAsset?.logo_URIs?.png,
        description: ibcAsset?.description,
        amount: displayAmount
      };
    }
  }
}
