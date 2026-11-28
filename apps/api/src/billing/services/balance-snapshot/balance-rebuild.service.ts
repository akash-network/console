import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { replayAllowance } from "@src/billing/lib/deployment-allowance-replay/deployment-allowance-replay";
import { type BalanceSnapshotOutput, BalanceSnapshotRepository } from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import { DeploymentAllowanceHistoryRepository } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

const DEPOSIT_GRANT_MSG_TYPE_URL = `/${MsgAccountDeposit.$type}`;

export type RebuiltGranterBalance = { granter: string; inSnapshot: number; rebuilt: number; onChain: number };

export type RebuiltBalance = { address: string; takenOn: string; height: number; rebuiltUpTo: number; balances: RebuiltGranterBalance[] };

/** Works a user's balance out from a snapshot and what the chain index shows of their grant since, to compare with the grant the chain holds now. */
@singleton()
export class BalanceRebuildService {
  constructor(
    private readonly balanceSnapshotRepository: BalanceSnapshotRepository,
    private readonly deploymentAllowanceHistoryRepository: DeploymentAllowanceHistoryRepository,
    private readonly balancesService: BalancesService,
    private readonly fundingWalletRegistry: FundingWalletRegistryService,
    private readonly blockHttpService: BlockHttpService,
    private readonly billingConfigService: BillingConfigService,
    private readonly coreConfigService: CoreConfigService
  ) {}

  /** Without a day, the latest complete snapshot is the starting point. */
  async rebuild(address: string, takenOn?: string): Promise<RebuiltBalance> {
    const snapshot = await this.#findComplete(takenOn);
    const denom = this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM");
    const [inSnapshot, currentGranter, rebuiltUpTo] = await Promise.all([
      this.balanceSnapshotRepository.findGrantsOf(snapshot.id, address),
      this.fundingWalletRegistry.getGranterAddressByWalletAddress(address),
      this.blockHttpService.getFreshCurrentHeight()
    ]);
    const amountByGranter = new Map(inSnapshot.filter(grant => grant.denom === denom).map(grant => [grant.granter, grant.amount]));

    if (!amountByGranter.has(currentGranter)) amountByGranter.set(currentGranter, 0);

    const balances: RebuiltGranterBalance[] = [];

    for (const [granter, amount] of amountByGranter) {
      balances.push(await this.#rebuildFor({ granter, grantee: address, inSnapshot: amount, denom, afterHeight: snapshot.height, rebuiltUpTo }));
    }

    return { address, takenOn: snapshot.takenOn, height: snapshot.height, rebuiltUpTo, balances };
  }

  async #findComplete(takenOn: string | undefined): Promise<BalanceSnapshotOutput> {
    const network = this.coreConfigService.get("NETWORK");
    const snapshot = takenOn
      ? await this.balanceSnapshotRepository.findByDay({ network, takenOn })
      : await this.balanceSnapshotRepository.findLatestComplete(network);

    if (snapshot?.status !== "complete") {
      throw createError(404, takenOn ? `No complete balance snapshot was taken on ${takenOn}` : "No complete balance snapshot was taken yet", { network });
    }

    return snapshot;
  }

  async #rebuildFor(input: {
    granter: string;
    grantee: string;
    inSnapshot: number;
    denom: string;
    afterHeight: number;
    rebuiltUpTo: number;
  }): Promise<RebuiltGranterBalance> {
    const [changes, onChain] = await Promise.all([
      this.deploymentAllowanceHistoryRepository.findChanges({
        granter: input.granter,
        grantee: input.grantee,
        msgTypeUrl: DEPOSIT_GRANT_MSG_TYPE_URL,
        afterHeight: input.afterHeight,
        before: { height: input.rebuiltUpTo + 1, txIndex: 0 }
      }),
      this.balancesService.retrieveDeploymentLimitAtLatestHeight({ address: input.grantee }, { granter: input.granter })
    ]);

    return {
      granter: input.granter,
      inSnapshot: input.inSnapshot,
      rebuilt: replayAllowance(input.inSnapshot, changes, input.denom),
      onChain: onChain.limit
    };
  }
}
