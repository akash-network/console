import { AuthzHttpService, DeploymentHttpService, type DeploymentInfo, type DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import type { FeeAllowancesResponse, WalletBalancesResponse } from "@src/billing/http-schemas/balance.schema";
import type { WalletInitialized } from "@src/billing/repositories";
import { reusePendingPromise } from "@src/caching/helpers";
import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { SpendRateService } from "@src/deployment/services/spend-rate/spend-rate.service";

type WalletBalances = WalletBalancesResponse["data"];
type Coin = WalletBalances["balances"][number];

const GRANTS_PAGE_SIZE = 1000;

@singleton()
export class WalletChainReaderService {
  /** Every tab refetches balances on mount and focus, so overlapping reads of one wallet share a single chain round-trip. */
  readonly #readBalancesOnce = reusePendingPromise((address: string) => this.#readBalances(address));

  constructor(
    @inject(CHAIN_SDK) private readonly chainSdk: ChainSDK,
    private readonly authzHttpService: AuthzHttpService,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly spendRateService: SpendRateService
  ) {}

  /** A deployment's escrow is spend, so a caller limited to projects sees only the deployments whose spend they may read. */
  async getBalances(wallet: WalletInitialized): Promise<WalletBalances> {
    const balances = await this.#readBalancesOnce(wallet.address);
    const visibleDseqs = new Set(
      await this.spendRateService.keepDeploymentsWithVisibleSpend(
        wallet,
        balances.activeDeployments.map(({ dseq }) => dseq)
      )
    );

    return { ...balances, activeDeployments: balances.activeDeployments.filter(({ dseq }) => visibleDseqs.has(dseq)) };
  }

  async getFeeAllowances(address: string): Promise<FeeAllowancesResponse["data"]> {
    const allowances = await this.authzHttpService.getValidFeeAllowancesForGrantee(address);

    return allowances.map(({ granter, allowance }) => ({
      granter,
      spendLimit: (allowance.spend_limit ?? []).map(toCoin),
      expiration: allowance.expiration ?? null
    }));
  }

  async #readBalances(address: string): Promise<WalletBalances> {
    const [{ balances }, grants, { deployments }] = await Promise.all([
      this.chainSdk.cosmos.bank.v1beta1.getAllBalances({ address }),
      this.authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: GRANTS_PAGE_SIZE }),
      this.deploymentHttpService.findAll({ owner: address, state: "active" })
    ]);

    return {
      balances: balances.map(toCoin),
      deploymentGrants: sumSpendLimitsPerDenom(grants),
      activeDeployments: deployments.map(toEscrowedDeployment)
    };
  }
}

function toCoin({ denom, amount }: Coin): Coin {
  return { denom, amount };
}

function sumSpendLimitsPerDenom(grants: DepositDeploymentGrant[]): Coin[] {
  const totals = new Map<string, number>();

  for (const { denom, amount } of grants.flatMap(grant => grant.authorization.spend_limits)) {
    totals.set(denom, (totals.get(denom) ?? 0) + (parseFloat(amount) || 0));
  }

  return Array.from(totals, ([denom, amount]) => ({ denom, amount: String(amount) }));
}

function toEscrowedDeployment({ deployment, escrow_account }: DeploymentInfo): WalletBalances["activeDeployments"][number] {
  return {
    dseq: deployment.id.dseq,
    escrow: {
      funds: escrow_account.state.funds.map(toCoin),
      settledAt: Number(escrow_account.state.settled_at)
    }
  };
}
