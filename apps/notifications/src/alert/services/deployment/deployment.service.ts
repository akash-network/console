import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import { LoggerService } from '@src/common/services/logger.service';
import { GlobalEnvConfig } from '@src/config/env.config';

@Injectable()
export class DeploymentService {
  constructor(
    private readonly configService: ConfigService<GlobalEnvConfig>,
    private readonly loggerService: LoggerService,
  ) {
    this.loggerService.setContext(DeploymentService.name);
  }

  async getDeploymentBalance(
    owner: string,
    dseq: string,
  ): Promise<{ balance: number } | null> {
    const { data: result } = await axios.get<any>(
      `${this.configService.getOrThrow('API_NODE_ENDPOINT')}/akash/deployment/v1beta3/deployments/info`,
      {
        params: {
          'id.owner': owner,
          'id.dseq': dseq,
        },
      },
    );

    if (!('deployment' in result)) {
      this.loggerService.error({
        event: 'BALANCE_FETCH_ERROR',
        owner,
        dseq,
        error: result,
      });

      return null;
    }

    if (result.deployment.state === 'closed') {
      this.loggerService.warn({
        event: 'DEPLOYMENT_CLOSED',
        owner,
        dseq,
        result,
      });

      return null;
    }

    const balance = result.escrow_account.balance;
    const funds = result.escrow_account.funds;

    const balanceAmount =
      balance.denom === 'uakt'
        ? parseInt(balance.amount)
        : parseInt(balance.amount) * 1_000_000;
    const fundsAmount =
      funds.denom === 'uakt'
        ? parseInt(funds.amount)
        : parseInt(funds.amount) * 1_000_000;

    return { balance: balanceAmount + fundsAmount };
  }
}
