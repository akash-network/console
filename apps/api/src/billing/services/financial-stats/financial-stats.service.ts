import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import axios from "axios";
import { Op, QueryTypes } from "sequelize";
import { singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { chainDb } from "@src/db/dbConnection";
import { RestCosmosBankBalancesResponse, CosmosDistributionCommunityPoolResponse } from "@src/types/rest";
import { apiNodeUrl } from "@src/utils/constants";

@singleton()
export class FinancialStatsService {
  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  async getPayingUserCount() {
    return this.userWalletRepository.payingUserCount();
  }

  async getMasterWalletBalanceUsdc() {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: "akash" });
    const [account] = await wallet.getAccounts();

    return this.getWalletBalances(account.address, USDC_IBC_DENOMS.mainnetId);
  }

  private async getWalletBalances(address: string, denom: string) {
    const response = await axios.get<RestCosmosBankBalancesResponse>(`${apiNodeUrl}/cosmos/bank/v1beta1/balances/${address}?pagination.limit=1000`);
    return parseFloat(response.data.balances.find(b => b.denom === denom)?.amount || "0");
  }

  async getAkashPubProviderBalances() {
    const akashPubProviders = await Provider.findAll({
      where: {
        hostUri: { [Op.like]: "%akash.pub:8443" }
      }
    });

    const balances = await Promise.all(
      akashPubProviders.map(async p => {
        const balance = await this.getWalletBalances(p.owner, USDC_IBC_DENOMS.mainnetId);
        return { provider: p.hostUri, balanceUsdc: balance / 1_000_000 };
      })
    );

    return balances;
  }

  async getCommunityPoolUsdc() {
    const communityPoolData = await axios.get<CosmosDistributionCommunityPoolResponse>(`${apiNodeUrl}/cosmos/distribution/v1beta1/community_pool`);
    return parseFloat(communityPoolData.data.pool.find(x => x.denom === USDC_IBC_DENOMS.mainnetId)?.amount || "0");
  }

  async getProviderRevenues() {
    const results = await chainDb.query<{ hostUri: string; usdEarned: string }>(
      `
  WITH trial_deployments_ids AS (
      SELECT DISTINCT m."relatedDeploymentId" AS "deployment_id"
      FROM "transaction" t
      INNER JOIN message m ON m."txId"=t.id
      WHERE t."memo"='managed wallet tx' AND m.type='/akash.market.v1beta4.MsgCreateLease' AND t.height > 18515430 AND m.height > 18515430 -- 18515430 is height on trial launch (2024-10-17)
  ),
  trial_leases AS (
      SELECT 
          l.owner AS "owner",
          l."createdHeight",
          l."closedHeight",
          l."providerAddress",
          l.denom AS denom,
          l.price AS price,
          LEAST((SELECT MAX(height) FROM block), COALESCE(l."closedHeight",l."predictedClosedHeight")) - l."createdHeight" AS duration
      FROM trial_deployments_ids
      INNER JOIN deployment d ON d.id="deployment_id"
      INNER JOIN lease l ON l."deploymentId"=d."id"
      WHERE l.denom='uusdc'
  ),
  billed_leases AS (
      SELECT
          l.owner,
          p."hostUri",
          ROUND(l.duration * l.price::numeric / 1000000, 2) AS "Spent USD"
      FROM trial_leases l
      INNER JOIN provider p ON p.owner=l."providerAddress"
  )
  SELECT
      "hostUri",
      SUM("Spent USD") AS "usdEarned"
  FROM billed_leases
  GROUP BY "hostUri"
  ORDER BY SUM("Spent USD") DESC
      `,
      { type: QueryTypes.SELECT }
    );

    return results.map(p => ({
      provider: p.hostUri,
      usdEarned: parseFloat(p.usdEarned)
    }));
  }
}
