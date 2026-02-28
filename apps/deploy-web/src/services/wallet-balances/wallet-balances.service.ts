import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";

import type { RestApiBalancesResponseType } from "@src/types";
import type { Balances } from "@src/types/address";
import type { RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";

export class WalletBalancesService {
  readonly #denoms: Denoms;

  constructor(
    private readonly authzHttpService: AuthzHttpService,
    private readonly chainApiHttpClient: AxiosInstance,
    denoms: Denoms
  ) {
    this.#denoms = denoms;
  }

  async getBalances(address: string): Promise<Balances> {
    const [balanceResponse, deploymentGrants, activeDeploymentsResponse] = await Promise.all([
      this.chainApiHttpClient.get<RestApiBalancesResponseType>(ApiUrlService.balance("", address)),
      this.authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
      loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList("", address, true), "deployments", 1000, this.chainApiHttpClient)
    ]);

    const deploymentGrantsPerDenom = deploymentGrants.reduce<Record<string, number>>((acc, grant) => {
      const spendLimit = grant.authorization?.spend_limit;
      if (spendLimit) {
        acc[spendLimit.denom] ??= 0;
        acc[spendLimit.denom] += parseFloat(spendLimit.amount || "0") || 0;
      }
      return acc;
    }, {});
    const balancesPerDenom = balanceResponse.data.balances.reduce<Record<string, number>>((acc, balance) => {
      acc[balance.denom] = parseFloat(balance.amount || "0") || 0;
      return acc;
    }, {});

    const activeDeployments = activeDeploymentsResponse.map(d => deploymentToDto(d));
    const deploymentEscrowPerDenom = activeDeployments.reduce<Record<string, number>>((acc, d) => {
      acc[d.denom] ??= 0;
      acc[d.denom] += d.escrowBalance;
      return acc;
    }, {});

    return {
      balanceUAKT: balancesPerDenom[this.#denoms.uakt] || 0,
      balanceUUSDC: balancesPerDenom[this.#denoms.usdc] || 0,
      balanceUACT: balancesPerDenom[this.#denoms.uact] || 0,
      deploymentEscrowUAKT: deploymentEscrowPerDenom[this.#denoms.uakt] || 0,
      deploymentEscrowUUSDC: deploymentEscrowPerDenom[this.#denoms.usdc] || 0,
      deploymentEscrowUACT: deploymentEscrowPerDenom[this.#denoms.uact] || 0,
      deploymentGrantsUAKT: deploymentGrantsPerDenom[this.#denoms.uakt] || 0,
      deploymentGrantsUUSDC: deploymentGrantsPerDenom[this.#denoms.usdc] || 0,
      deploymentGrantsUACT: deploymentGrantsPerDenom[this.#denoms.uact] || 0,
      activeDeployments,
      deploymentGrants
    };
  }
}

interface Denoms {
  uakt: string;
  usdc: string;
  uact: string;
}
