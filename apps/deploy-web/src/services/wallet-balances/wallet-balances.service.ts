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

    const deploymentGrantsUAKT = deploymentGrants
      .filter(grant => grant.authorization?.spend_limit?.denom === this.#denoms.uakt)
      .reduce((sum, grant) => sum + parseFloat(grant.authorization?.spend_limit?.amount || "0"), 0);
    const deploymentGrantsUUSDC = deploymentGrants
      .filter(grant => grant.authorization?.spend_limit?.denom === this.#denoms.usdc)
      .reduce((sum, grant) => sum + parseFloat(grant.authorization?.spend_limit?.amount || "0"), 0);

    const balanceData = balanceResponse.data;
    const balanceUAKT =
      balanceData.balances.some(b => b.denom === this.#denoms.uakt) || deploymentGrantsUAKT > 0
        ? parseFloat(balanceData.balances.find(b => b.denom === this.#denoms.uakt)?.amount || "0")
        : 0;
    const balanceUUSDC =
      balanceData.balances.some(b => b.denom === this.#denoms.usdc) || deploymentGrantsUUSDC > 0
        ? parseFloat(balanceData.balances.find(b => b.denom === this.#denoms.usdc)?.amount || "0")
        : 0;

    const activeDeployments = activeDeploymentsResponse.map(d => deploymentToDto(d));
    const aktActiveDeployments = activeDeployments.filter(d => d.denom === this.#denoms.uakt);
    const usdcActiveDeployments = activeDeployments.filter(d => d.denom === this.#denoms.usdc);
    const deploymentEscrowUAKT = aktActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);
    const deploymentEscrowUUSDC = usdcActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);

    return {
      balanceUAKT,
      balanceUUSDC,
      deploymentEscrowUAKT,
      deploymentEscrowUUSDC,
      deploymentGrantsUAKT,
      deploymentGrantsUUSDC,
      activeDeployments,
      deploymentGrants
    };
  }
}

interface Denoms {
  uakt: string;
  usdc: string;
}
