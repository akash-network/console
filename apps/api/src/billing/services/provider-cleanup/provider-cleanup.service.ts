import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService, RpcMessageService } from "@src/billing/services";
import { ErrorService } from "@src/core/services/error/error.service";
import { ProviderCleanupSummarizer } from "@src/deployment/lib/provider-cleanup-summarizer/provider-cleanup-summarizer";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { TxSignerService } from "../tx-signer/tx-signer.service";

export interface ProviderCleanupParams {
  concurrency: number;
  provider: string;
  dryRun: boolean;
}

@singleton()
export class ProviderCleanupService {
  private readonly logger = LoggerService.forContext(ProviderCleanupService.name);

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly txSignerService: TxSignerService,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly rpcMessageService: RpcMessageService,
    private readonly errorService: ErrorService
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
    const client = await this.txSignerService.getClientForAddressIndex(wallet.id);
    const deployments = await this.deploymentRepository.findDeploymentsForProvider({
      owner: wallet.address,
      provider: options.provider
    });

    const closeAllWalletStaleDeployments = deployments.map(async deployment => {
      const message = this.rpcMessageService.getCloseDeploymentMsg(wallet.address, deployment.dseq);
      this.logger.info({ event: "PROVIDER_CLEAN_UP", params: { owner: wallet.address, dseq: deployment.dseq } });

      try {
        if (!options.dryRun) {
          await client.signAndBroadcast([message]);
          this.logger.info({ event: "PROVIDER_CLEAN_UP_SUCCESS" });
        }
      } catch (error) {
        if (error.message.includes("not allowed to pay fees")) {
          if (!options.dryRun) {
            await this.managedUserWalletService.authorizeSpending({
              address: wallet.address,
              limits: {
                fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT
              }
            });
            await client.signAndBroadcast([message]);
            this.logger.info({ event: "PROVIDER_CLEAN_UP_SUCCESS" });
          }
        } else {
          throw error;
        }
      } finally {
        summary.inc("deploymentCount");
      }
    });

    await Promise.all(closeAllWalletStaleDeployments);
  }
}
