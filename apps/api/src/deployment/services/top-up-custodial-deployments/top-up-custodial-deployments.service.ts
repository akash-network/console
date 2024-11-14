import { AllowanceHttpService, BalanceHttpService, DeploymentAllowance } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

import { ExecDepositDeploymentMsgOptions, MasterSigningClientService, RpcMessageService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ErrorService } from "@src/core/services/error/error.service";
import { TopUpSummarizer } from "@src/deployment/lib/top-up-summarizer/top-up-summarizer";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { TopUpToolsService } from "@src/deployment/services/top-up-tools/top-up-tools.service";
import { DeploymentsRefiller, TopUpDeploymentsOptions } from "@src/deployment/types/deployments-refiller";

interface Balances {
  denom: string;
  feesLimit: number;
  deploymentLimit: number;
  balance: number;
}

interface TopUpSummary {
  deploymentCount: number;
  minPredictedClosedHeight: number;
  maxPredictedClosedHeight: number;
  insufficientBalanceCount: number;
}

@singleton()
export class TopUpCustodialDeploymentsService implements DeploymentsRefiller {
  private readonly CONCURRENCY = 10;

  private readonly MIN_FEES_AVAILABLE = 5000;

  private readonly logger = LoggerService.forContext(TopUpCustodialDeploymentsService.name);

  constructor(
    private readonly topUpToolsService: TopUpToolsService,
    private readonly allowanceHttpService: AllowanceHttpService,
    private readonly balanceHttpService: BalanceHttpService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly rpcClientService: RpcMessageService,
    private readonly blockHttpService: BlockHttpService,
    private readonly errorService: ErrorService
  ) {}

  async topUpDeployments(options: TopUpDeploymentsOptions) {
    const summary = new TopUpSummarizer();
    summary.set("startBlockHeight", await this.blockHttpService.getCurrentHeight());

    const topUpAllCustodialDeployments = this.topUpToolsService.pairs.map(async ({ wallet, client }) => {
      const address = await wallet.getFirstAddress();
      await this.allowanceHttpService.paginateDeploymentGrants({ grantee: address, limit: this.CONCURRENCY }, async grants => {
        await Promise.all(
          grants.map(async grant => {
            await this.errorService.execWithErrorHandler(
              { grant, event: "TOP_UP_ERROR" },
              () => this.topUpForGrant(grant, client, options, summary),
              () => summary.inc("walletsTopUpErrorCount")
            );
          })
        );
      });
    });
    await Promise.all(topUpAllCustodialDeployments);

    summary.set("endBlockHeight", await this.blockHttpService.getCurrentHeight());
    this.logger.info({ event: "TOP_UP_SUMMARY", summary: summary.summarize() });
  }

  private async topUpForGrant(
    grant: DeploymentAllowance,
    client: MasterSigningClientService,
    options: TopUpDeploymentsOptions,
    summary: TopUpSummarizer
  ): Promise<TopUpSummary> {
    summary.inc("walletsCount");
    const owner = grant.granter;
    const { grantee } = grant;
    const drainingDeployments = await this.drainingDeploymentService.findDeployments(owner, grant.authorization.spend_limit.denom);
    summary.inc("deploymentCount", drainingDeployments.length);

    if (!drainingDeployments.length) {
      return;
    }

    const balances = await this.collectWalletBalances(grant);

    let { deploymentLimit, feesLimit, balance } = balances;
    let hasTopUp = false;

    for (const { dseq, denom, blockRate, predictedClosedHeight } of drainingDeployments) {
      const amount = await this.drainingDeploymentService.calculateTopUpAmount({ blockRate });
      if (!this.canTopUp(amount, { deploymentLimit, feesLimit, balance })) {
        this.logger.info({ event: "INSUFFICIENT_BALANCE", granter: owner, grantee, balances: { deploymentLimit, feesLimit, balance } });
        summary.inc("insufficientBalanceCount");
        break;
      }
      deploymentLimit -= amount;
      feesLimit -= this.MIN_FEES_AVAILABLE;
      balance -= amount + this.MIN_FEES_AVAILABLE;

      await this.topUpDeployment(
        {
          dseq,
          amount,
          denom,
          owner,
          grantee
        },
        client,
        options
      );

      hasTopUp = true;
      summary.inc("deploymentTopUpCount");
      summary.ensurePredictedClosedHeight(predictedClosedHeight);
    }

    if (hasTopUp) {
      summary.inc("walletsTopUpCount");
    }
  }

  private async collectWalletBalances(grant: DeploymentAllowance): Promise<Balances> {
    const denom = grant.authorization.spend_limit.denom;
    const deploymentLimit = parseFloat(grant.authorization.spend_limit.amount);

    const feesLimit = await this.retrieveFeesLimit(grant.granter, grant.grantee, denom);
    const { amount } = await this.balanceHttpService.getBalance(grant.granter, denom);
    const balance = parseFloat(amount);

    return {
      denom,
      feesLimit,
      deploymentLimit,
      balance
    };
  }

  private async retrieveFeesLimit(granter: string, grantee: string, denom: string) {
    const feesAllowance = await this.allowanceHttpService.getFeeAllowanceForGranterAndGrantee(granter, grantee);
    const feesSpendLimit = feesAllowance.allowance.spend_limit.find(limit => limit.denom === denom);

    return feesSpendLimit ? parseFloat(feesSpendLimit.amount) : 0;
  }

  private canTopUp(amount: number, balances: Pick<Balances, "balance" | "deploymentLimit" | "feesLimit">) {
    return balances.deploymentLimit > amount && balances.feesLimit > this.MIN_FEES_AVAILABLE && balances.balance > amount + this.MIN_FEES_AVAILABLE;
  }

  async topUpDeployment({ grantee, ...messageInput }: ExecDepositDeploymentMsgOptions, client: MasterSigningClientService, options: TopUpDeploymentsOptions) {
    const message = this.rpcClientService.getExecDepositDeploymentMsg({ grantee, ...messageInput });
    this.logger.info({ event: "TOP_UP_DEPLOYMENT", params: { ...messageInput, masterWallet: grantee }, dryRun: options.dryRun });

    if (!options.dryRun) {
      await client.executeTx([message], { fee: { granter: messageInput.owner } });
      this.logger.info({ event: "TOP_UP_DEPLOYMENT_SUCCESS" });
    }
  }
}
