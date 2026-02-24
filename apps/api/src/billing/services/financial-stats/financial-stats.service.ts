import { Provider } from "@akashnetwork/database/dbSchemas/akash";
import { CosmosHttpService } from "@akashnetwork/http-sdk";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { inject, singleton } from "tsyringe";

import { USDC_IBC_DENOMS } from "@src/billing/config/network.config";
import { UserWalletRepository } from "@src/billing/repositories";
import { CHAIN_DB } from "@src/chain";
import { TxManagerService } from "../tx-manager/tx-manager.service";

@singleton()
export class FinancialStatsService {
  readonly #chainDb: Sequelize;

  constructor(
    @inject(CHAIN_DB) chainDb: Sequelize,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly cosmosHttpService: CosmosHttpService,
    private readonly txManagerService: TxManagerService
  ) {
    this.#chainDb = chainDb;
  }

  async getPayingUserCount() {
    return this.userWalletRepository.payingUserCount();
  }

  async getMasterWalletBalanceUsdc() {
    return this.getWalletBalances(await this.txManagerService.getFundingWalletAddress(), USDC_IBC_DENOMS.mainnetId);
  }

  private async getWalletBalances(address: string, denom: string) {
    const response = await this.cosmosHttpService.getBankBalancesByAddress(address);
    return parseFloat(response.balances.find(b => b.denom === denom)?.amount || "0");
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

  async getCommunityPoolUsdc(): Promise<number> {
    const pool = await this.cosmosHttpService.getCommunityPool();
    return parseFloat(pool.find(x => x.denom === USDC_IBC_DENOMS.mainnetId)?.amount || "0");
  }

  async getProviderRevenues() {
    const results = await this.#chainDb.query<{ hostUri: string; usdEarned: string }>(
      `/* financial-stats:provider-revenues */
  WITH trial_deployments_ids AS (
      SELECT DISTINCT m."relatedDeploymentId" AS "deployment_id"
      FROM "transaction" t
      INNER JOIN message m ON m."txId"=t.id
      WHERE t."memo"='managed wallet tx' AND (m.type='/akash.market.v1beta4.MsgCreateLease' OR m.type='/akash.market.v1beta5.MsgCreateLease') AND t.height > 18515430 AND m.height > 18515430 -- 18515430 is height on trial launch (2024-10-17)
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
