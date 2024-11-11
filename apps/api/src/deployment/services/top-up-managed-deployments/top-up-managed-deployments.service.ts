import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { MasterWalletService, RpcMessageService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { DeploymentsRefiller, TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";

@singleton()
export class TopUpManagedDeploymentsService implements DeploymentsRefiller {
  private readonly CONCURRENCY = 10;

  private readonly logger = new LoggerService({ context: TopUpManagedDeploymentsService.name });

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly txSignerService: TxSignerService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    @InjectWallet("MANAGED") private readonly managedMasterWalletService: MasterWalletService,
    private readonly balancesService: BalancesService,
    private readonly rpcClientService: RpcMessageService,
    private readonly errorService: ErrorService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions) {
    await this.userWalletRepository.paginate({ limit: this.CONCURRENCY }, async wallets => {
      await Promise.all(
        wallets.map(async wallet => {
          await this.errorService.execWithErrorHandler({ wallet, event: "TOP_UP_ERROR" }, () => this.topUpForWallet(wallet, options));
        })
      );
    });
  }

  private async topUpForWallet(wallet: UserWalletOutput, options: TopUpDeploymentsOptions) {
    const owner = wallet.address;
    const denom = this.billingConfig.DEPLOYMENT_GRANT_DENOM;
    const drainingDeployments = await this.drainingDeploymentService.findDeployments(owner, denom);
    const signer = await this.txSignerService.getClientForAddressIndex(wallet.id);
    const depositor = await this.managedMasterWalletService.getFirstAddress();

    let balance = await this.balancesService.retrieveAndCalcDeploymentLimit(wallet);

    for (const deployment of drainingDeployments) {
      const amount = await this.drainingDeploymentService.calculateTopUpAmount(deployment);
      if (amount > balance) {
        this.logger.info({ event: "INSUFFICIENT_BALANCE", owner, balance });
        break;
      }
      balance -= amount;
      const messageInput = { dseq: deployment.dseq, amount, denom, owner, depositor };
      const message = this.rpcClientService.getDepositDeploymentMsg(messageInput);
      this.logger.info({ event: "TOP_UP_DEPLOYMENT", params: messageInput, dryRun: options.dryRun });

      if (!options.dryRun) {
        await signer.signAndBroadcast([message]);
        this.logger.info({ event: "TOP_UP_SUCCESS" });
      }
    }
  }
}
