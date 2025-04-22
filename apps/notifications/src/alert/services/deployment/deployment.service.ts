import { Injectable } from '@nestjs/common';

import { BlockchainNodeHttpService } from '@src/alert/services/blockchain-node-http/blockchain-node-http.service';
import { LoggerService } from '@src/common/services/logger.service';

export type DeploymentInfo = {
  deployment: {
    state: string;
  };
  escrow_account: {
    balance: {
      denom: string;
      amount: string;
    };
    funds: {
      denom: string;
      amount: string;
    };
  };
};

@Injectable()
export class DeploymentService {
  constructor(
    private readonly blockchainClientService: BlockchainNodeHttpService,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(DeploymentService.name);
  }

  async getDeploymentBalance(
    owner: string,
    dseq: string,
  ): Promise<{ balance: number } | null> {
    const { data } = await this.blockchainClientService.get<DeploymentInfo>(
      '/akash/deployment/v1beta3/deployments/info',
      {
        params: {
          'id.owner': owner,
          'id.dseq': dseq,
        },
      },
    );

    if (data.deployment.state === 'closed') {
      this.loggerService.warn({
        event: 'DEPLOYMENT_CLOSED',
        owner,
        dseq,
        data,
      });

      return null;
    }

    const balance = data.escrow_account.balance;
    const funds = data.escrow_account.funds;

    const balanceAmount =
      balance.denom === 'uakt'
        ? parseInt(balance.amount, 10)
        : parseInt(balance.amount, 10) * 1_000_000;
    const fundsAmount =
      funds.denom === 'uakt'
        ? parseInt(funds.amount, 10)
        : parseInt(funds.amount, 10) * 1_000_000;

    return { balance: balanceAmount + fundsAmount };
  }
}
