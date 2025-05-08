import { Injectable } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { backOff } from 'exponential-backoff';
import { Err, Ok, Result } from 'ts-results';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { RichError } from '@src/lib/rich-error/rich-error';
import { BlockchainNodeHttpService } from '@src/modules/alert/services/blockchain-node-http/blockchain-node-http.service';

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
  ): Promise<Result<{ balance: number }, RichError>> {
    try {
      const result = await this.getDeploymentInfo(owner, dseq);

      if (result.err) {
        return result;
      }

      const {
        val: { data },
      } = result;

      if (data.deployment.state === 'closed') {
        this.loggerService.warn({
          event: 'DEPLOYMENT_CLOSED',
          owner,
          dseq,
          data,
        });

        return Err(new RichError('Deployment closed', 'DEPLOYMENT_CLOSED'));
      }

      const balanceAmount = parseInt(data.escrow_account.balance.amount, 10);
      const fundsAmount = parseInt(data.escrow_account.funds.amount, 10);

      return Ok({ balance: balanceAmount + fundsAmount });
    } catch (error: unknown) {
      return Err(RichError.enrich(error, 'UNKNOWN'));
    }
  }

  async getDeploymentInfo(
    owner: string,
    dseq: string,
  ): Promise<Result<AxiosResponse<DeploymentInfo>, RichError>> {
    try {
      return Ok(
        await backOff(
          () =>
            this.blockchainClientService.get<DeploymentInfo>(
              '/akash/deployment/v1beta3/deployments/info',
              {
                params: {
                  'id.owner': owner,
                  'id.dseq': dseq,
                },
              },
            ),
          {
            maxDelay: 5_000,
            startingDelay: 500,
            timeMultiple: 2,
            numOfAttempts: 3,
            jitter: 'full',
          },
        ),
      );
    } catch (error: unknown) {
      return Err(
        RichError.enrich(error, 'DEPLOYMENT_FETCH_ERROR', { owner, dseq }),
      );
    }
  }
}
