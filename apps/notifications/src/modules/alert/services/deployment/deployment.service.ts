import { DeploymentHttpService, DeploymentInfo, LeaseHttpService } from "@akashnetwork/http-sdk";
import { Injectable } from "@nestjs/common";
import { Err, Ok, Result } from "ts-results";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { RichError } from "@src/lib/rich-error/rich-error";

@Injectable()
export class DeploymentService {
  constructor(
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(DeploymentService.name);
  }

  async getDeploymentBalance(owner: string, dseq: string, block: number): Promise<Result<{ balance: number }, RichError>> {
    try {
      const [deploymentResult, pricePerBlock] = await Promise.all([this.getDeploymentInfo(owner, dseq), this.getPricePerBlock(owner, dseq)]);

      if (deploymentResult.err) {
        return deploymentResult;
      }

      const deploymentInfo = deploymentResult.val;
      if (deploymentInfo.deployment.state === "closed") {
        this.loggerService.warn({
          event: "DEPLOYMENT_CLOSED",
          owner,
          dseq,
          deploymentInfo
        });

        return Err(new RichError("Deployment closed", "DEPLOYMENT_CLOSED"));
      }

      if (pricePerBlock === 0) {
        return Err(new RichError("Deployment has no price", "DEPLOYMENT_NO_PRICE"));
      }

      const blocksPassed = Math.abs(parseInt(deploymentInfo.escrow_account.state.settled_at, 10) - block);
      const balance = parseFloat(deploymentInfo.escrow_account.state.funds.reduce((sum, { amount }) => sum + parseFloat(amount), 0).toFixed(18));
      const blocksLeft = balance / pricePerBlock - blocksPassed;
      const escrow = Math.max(blocksLeft * pricePerBlock, 0);

      return Ok({ balance: escrow });
    } catch (error: unknown) {
      return Err(RichError.enrich(error, "UNKNOWN"));
    }
  }

  async getDeploymentInfo(owner: string, dseq: string): Promise<Result<DeploymentInfo, RichError>> {
    try {
      const result = await this.deploymentHttpService.findByOwnerAndDseq(owner, dseq);

      if ("code" in result) {
        return Err(new RichError(result.message, result.code, { owner, dseq, details: result.details }, result));
      }

      return Ok(result);
    } catch (error: unknown) {
      return Err(RichError.enrich(error, "DEPLOYMENT_FETCH_ERROR", { owner, dseq }));
    }
  }

  private async getPricePerBlock(owner: string, dseq: string) {
    const leases = await this.leaseHttpService.list({ owner, dseq });
    return leases.leases.reduce((prev, current) => prev + parseFloat(current.lease.price.amount), 0);
  }

  async deploymentExists(owner: string, dseq: string): Promise<boolean> {
    const result = await this.getDeploymentInfo(owner, dseq);
    return result.ok;
  }
}
