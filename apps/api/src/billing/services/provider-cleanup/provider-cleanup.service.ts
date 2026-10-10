import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { singleton } from "tsyringe";

import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type ProviderCleanupParams } from "@src/billing/types/provider-cleanup";
import { ErrorService } from "@src/core/services/error/error.service";
import { ProviderCleanupSummarizer } from "@src/deployment/lib/provider-cleanup-summarizer/provider-cleanup-summarizer";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { DeploymentOrganizationActivityService } from "@src/deployment/services/deployment-organization-activity/deployment-organization-activity.service";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

@singleton()
export class ProviderCleanupService {
  private readonly logger = createOtelLogger({ context: ProviderCleanupService.name });

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly errorService: ErrorService,
    private readonly chainErrorService: ChainErrorService,
    private readonly deploymentOrganizationActivityService: DeploymentOrganizationActivityService
  ) {}

  async cleanup(options: ProviderCleanupParams) {
    const summary = new ProviderCleanupSummarizer();
    await this.userWalletRepository.paginate({ query: { isTrialing: true }, limit: options.concurrency || 10 }, async wallets => {
      const cleanUpAllWallets = wallets.map(async wallet => {
        await this.errorService.execWithErrorHandler(
          {
            wallet,
            event: "PROVIDER_CLEAN_UP_ERROR",
            context: ProviderCleanupService.name
          },
          () => this.cleanUpForWallet(wallet, options, summary)
        );
      });

      await Promise.all(cleanUpAllWallets);
    });

    this.logger.info({ event: "PROVIDER_CLEAN_UP_SUMMARY", summary: summary.summarize(), dryRun: options.dryRun });
  }

  private async cleanUpForWallet(wallet: UserWalletOutput, options: ProviderCleanupParams, summary: ProviderCleanupSummarizer) {
    const deployments = await this.deploymentRepository.findDeploymentsForProvider({
      owner: wallet.address!,
      provider: options.provider
    });

    const closeAllWalletStaleDeployments = deployments.map(async deployment => {
      const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address!, deployment.dseq);
      this.logger.info({ event: "PROVIDER_CLEAN_UP", params: { owner: wallet.address, dseq: deployment.dseq } });

      try {
        if (!options.dryRun) {
          await this.#broadcastClose(wallet.id, message);
          await this.#recordClosed(wallet, deployment.dseq);
          this.logger.info({ event: "PROVIDER_CLEAN_UP_SUCCESS" });
        }
      } catch (error) {
        if (!this.chainErrorService.isFeeGrantRefusedError(error)) {
          throw error;
        }

        await this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
          address: wallet.address!,
          limits: {
            fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
          }
        });
        await this.#broadcastClose(wallet.id, message);
        await this.#recordClosed(wallet, deployment.dseq);
        this.logger.info({ event: "PROVIDER_CLEAN_UP_SUCCESS" });
      } finally {
        summary.inc("deploymentCount");
      }
    });

    await Promise.all(closeAllWalletStaleDeployments);
  }

  async #broadcastClose(walletId: number, message: EncodeObject): Promise<void> {
    const tx = await this.managedSignerService.executeDerivedTx(walletId, [message]);

    if (tx.code !== COSMOS_TX_CODE_OK) {
      throw new Error(`Close tx ${tx.hash} failed on-chain with code ${tx.code}: ${tx.rawLog}`);
    }
  }

  async #recordClosed(wallet: UserWalletOutput, dseq: string): Promise<void> {
    await this.deploymentOrganizationActivityService.recordClosed({ userId: wallet.userId, dseq }, { actorUserId: null, reason: null });
  }
}
