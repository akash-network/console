import { AllowanceHttpService, DeploymentAllowance } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { ErrorService } from "@src/core/services/error/error.service";
import { DrainingDeploymentOutput } from "@src/deployment/repositories/lease/lease.repository";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";

@singleton()
export class TopUpManagedDeploymentsService {
  private readonly CONCURRENCY = 10;

  private readonly logger = new LoggerService({ context: TopUpManagedDeploymentsService.name });

  constructor(
    private readonly allowanceHttpService: AllowanceHttpService,
    @InjectWallet("MANAGED") private readonly managedMasterWalletService: MasterWalletService,
    @InjectSigningClient("MANAGED") private readonly managedMasterSigningClientService: MasterSigningClientService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly errorService: ErrorService
  ) {}

  async topUpDeployments() {
    const address = await this.managedMasterWalletService.getFirstAddress();
    await this.allowanceHttpService.paginateDeploymentGrants({ granter: address, limit: this.CONCURRENCY }, async grants => {
      await Promise.all(
        grants.map(async grant => {
          await this.errorService.execWithErrorHandler({ grant, event: "TOP_UP_FAILED" }, () => this.topUpForGrant(grant));
        })
      );
    });
  }

  private async topUpForGrant(grant: DeploymentAllowance) {
    const owner = grant.grantee;

    let balance = parseFloat(grant.authorization.spend_limit.amount);
    const denom = grant.authorization.spend_limit.denom;
    const drainingDeployments = await this.drainingDeploymentService.findDeployments(owner, denom);

    for (const deployment of drainingDeployments) {
      const topUpAmount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
      if (topUpAmount > balance) {
        this.logger.debug({ event: "INSUFFICIENT_BALANCE", granter: grant.granter, grantee: owner, balance });
        break;
      }
      balance -= topUpAmount;

      await this.topUpDeployment(topUpAmount, deployment);
    }
  }

  async topUpDeployment(amount: number, deployment: DrainingDeploymentOutput) {
    this.logger.debug({ event: "TOPPING_UP_MANAGED_DEPLOYMENT", amount, deployment, warning: "Not implemented yet" });
  }
}
