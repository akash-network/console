import { Err, Ok, Result } from "ts-results";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { LoggerService } from "@src/core";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository, type ExpiredRuntimeDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";

/**
 * Closes deployments that have reached their runtime limit, which is what makes a limit mean anything:
 * without this the chain only closes a deployment once its escrow drains, so a cheap deployment holding
 * the default deposit outlives a short limit by weeks. Closing settles the escrow and returns the
 * remainder, so a limit reached early costs the user nothing extra.
 *
 * Safe to run concurrently with the funding sweep and with itself. Each pass re-reads `closed = false`,
 * the on-chain close is a no-op once a deployment is already closed, and funding never deposits past a
 * deadline. An extension that lands while a close is in flight loses the race by design: the deadline
 * moved, but this pass had already read it. The funding job then records a `deployment_closed` skip and
 * the user sees a closed deployment, which is the same outcome as extending a second too late.
 */
@singleton()
export class ExpiredDeploymentsCloserService {
  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly chainErrorService: ChainErrorService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(ExpiredDeploymentsCloserService.name);
  }

  async closeExpiredDeployments({ dryRun }: DryRunOptions): Promise<Result<void, unknown[]>> {
    const expired = await this.deploymentSettingRepository.findExpiredRuntimeDeployments();

    this.logger.info({ event: "EXPIRED_DEPLOYMENTS_SWEEP_START", count: expired.length, dryRun });

    const errors: unknown[] = [];
    let closedCount = 0;

    for (const deployment of expired) {
      try {
        if (await this.#closeExpiredDeployment(deployment, dryRun)) {
          closedCount++;
        }
      } catch (error) {
        this.logger.error({ event: "EXPIRED_DEPLOYMENT_CLOSE_FAILED", dseq: deployment.dseq, owner: deployment.address, error });
        errors.push(error);
      }
    }

    this.logger.info({ event: "EXPIRED_DEPLOYMENTS_SWEEP_END", found: expired.length, closed: closedCount, failed: errors.length, dryRun });

    return errors.length > 0 ? Err(errors) : Ok(undefined);
  }

  async #closeExpiredDeployment(deployment: ExpiredRuntimeDeployment, dryRun: boolean): Promise<boolean> {
    const wallet = await this.userWalletRepository.findById(deployment.walletId);

    if (!wallet?.address) {
      this.logger.warn({
        event: "EXPIRED_DEPLOYMENT_SKIPPED",
        reason: "WALLET_NOT_INITIALIZED",
        dseq: deployment.dseq,
        walletId: deployment.walletId
      });
      return false;
    }

    if (dryRun) {
      this.logger.info({ event: "EXPIRED_DEPLOYMENT_WOULD_CLOSE", dseq: deployment.dseq, owner: wallet.address, walletId: wallet.id });
      return false;
    }

    try {
      await this.deploymentWriterService.close({ ...wallet, address: wallet.address }, deployment.dseq);
    } catch (error) {
      if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
        this.logger.warn({
          event: "EXPIRED_DEPLOYMENT_UNSETTLEABLE",
          reason: "Deployment escrow cannot be settled yet; chain rejects close until it settles",
          dseq: deployment.dseq,
          owner: wallet.address
        });
        return false;
      }
      throw error;
    }

    await this.deploymentSettingRepository.updateById(deployment.id, { closed: true });

    this.logger.info({ event: "EXPIRED_DEPLOYMENT_CLOSED", dseq: deployment.dseq, owner: wallet.address });

    return true;
  }
}
