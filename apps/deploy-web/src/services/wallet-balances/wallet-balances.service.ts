import type { AuthzHttpService } from "@akashnetwork/http-sdk";
import type { AxiosInstance } from "axios";

import { UAKT_DENOM } from "@src/config/denom.config";
import { getUsdcDenom } from "@src/hooks/useDenom";
import type { RestApiBalancesResponseType } from "@src/types";
import type { Balances } from "@src/types/address";
import type { RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";

export class WalletBalancesService {
  constructor(
    private readonly authzHttpService: AuthzHttpService,
    private readonly chainApiHttpClient: AxiosInstance,
    private readonly masterWalletAddress: string
  ) {}

  async getBalances(address: string): Promise<Balances> {
    const usdcIbcDenom = getUsdcDenom();
    const [balanceResponse, deploymentGrants, activeDeploymentsResponse] = await Promise.all([
      this.chainApiHttpClient.get<RestApiBalancesResponseType>(ApiUrlService.balance("", address)),
      this.authzHttpService.getAllDepositDeploymentGrants({ grantee: address, limit: 1000 }),
      loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList("", address, true), "deployments", 1000, this.chainApiHttpClient)
    ]);

    const deploymentGrantsUAKT = deploymentGrants
      .filter(grant => grant.authorization?.spend_limit?.denom === UAKT_DENOM)
      .reduce((sum, grant) => sum + parseFloat(grant.authorization?.spend_limit?.amount || "0"), 0);
    const deploymentGrantsUUSDC = deploymentGrants
      .filter(grant => grant.authorization?.spend_limit?.denom === usdcIbcDenom)
      .reduce((sum, grant) => sum + parseFloat(grant.authorization?.spend_limit?.amount || "0"), 0);

    const balanceData = balanceResponse.data;
    const balanceUAKT =
      balanceData.balances.some(b => b.denom === UAKT_DENOM) || deploymentGrantsUAKT > 0
        ? parseFloat(balanceData.balances.find(b => b.denom === UAKT_DENOM)?.amount || "0")
        : 0;
    const balanceUUSDC =
      balanceData.balances.some(b => b.denom === usdcIbcDenom) || deploymentGrantsUUSDC > 0
        ? parseFloat(balanceData.balances.find(b => b.denom === usdcIbcDenom)?.amount || "0")
        : 0;

    const activeDeployments = activeDeploymentsResponse.map(d => deploymentToDto(d));
    const aktActiveDeployments = activeDeployments.filter(d => d.denom === UAKT_DENOM);
    const usdcActiveDeployments = activeDeployments.filter(d => d.denom === usdcIbcDenom);
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
