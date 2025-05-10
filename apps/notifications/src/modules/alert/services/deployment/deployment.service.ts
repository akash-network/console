import { DeploymentHttpService } from '@akashnetwork/http-sdk';
import { Injectable } from '@nestjs/common';
import { backOff } from 'exponential-backoff';
import { Err, Ok, Result } from 'ts-results';

import { LoggerService } from '@src/common/services/logger/logger.service';
import { RichError } from '@src/lib/rich-error/rich-error';

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
    private readonly deploymentHttpService: DeploymentHttpService,
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
      const val = result.val;
      if (val.deployment.state === 'closed') {
        this.loggerService.warn({
          event: 'DEPLOYMENT_CLOSED',
          owner,
          dseq,
          val,
        });

        return Err(new RichError('Deployment closed', 'DEPLOYMENT_CLOSED'));
      }

      const balanceAmount = parseInt(val.escrow_account.balance.amount, 10);
      const fundsAmount = parseInt(val.escrow_account.funds.amount, 10);

      return Ok({ balance: balanceAmount + fundsAmount });
    } catch (error: unknown) {
      return Err(RichError.enrich(error, 'UNKNOWN'));
    }
  }

  async getDeploymentInfo(
    owner: string,
    dseq: string,
  ): Promise<Result<DeploymentInfo, RichError>> {
    try {
      const result = await backOff(
        () => this.deploymentHttpService.findByOwnerAndDseq(owner, dseq),
        {
          maxDelay: 5_000,
          startingDelay: 500,
          timeMultiple: 2,
          numOfAttempts: 3,
          jitter: 'full',
        },
      );

      if ('code' in result) {
        return Err(
          new RichError(
            result.message,
            result.code,
            { owner, dseq, details: result.details },
            result,
          ),
        );
      }

      return Ok(result);
    } catch (error: unknown) {
      return Err(
        RichError.enrich(error, 'DEPLOYMENT_FETCH_ERROR', { owner, dseq }),
      );
    }
  }
}
