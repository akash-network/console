import { AuthzHttpService } from "@akashnetwork/http-sdk";
import createError from "http-errors";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { type FundingWalletOutput, FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletMoveRepository, type FundingWalletMoveStatus } from "@src/billing/repositories/funding-wallet-move/funding-wallet-move.repository";
import { FundingWalletMoveService } from "@src/billing/services/funding-wallet-move/funding-wallet-move.service";
import {
  MoveUserToActiveFundingWallet,
  moveUserToActiveFundingWalletKeyFor
} from "@src/billing/services/funding-wallet-move/move-user-to-active-funding-wallet.job";
import { FUNDING_WALLET_MOVE_PRIORITY, FundingWalletMoveQueueService } from "@src/billing/services/funding-wallet-move-queue/funding-wallet-move-queue.service";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";

const GRANTEES_PAGE_SIZE = 500;

const UNFINISHED_MOVE_STATUSES: FundingWalletMoveStatus[] = ["revoking", "revoked", "crediting"];

type DrainingWallet = FundingWalletOutput & { drainingSince: Date };

export type FundingWalletDrainStatus = {
  address: string;
  lateGrantsEndAt: string;
  depositGrantsLeft: number;
  feeAllowancesLeft: number;
  moves: Partial<Record<FundingWalletMoveStatus, number>>;
};

export type FundingWalletMovesQueued = { queued: number; alreadyQueued: number; withOpenDeployments: number; unknownGrantees: number };

/** Empties the funding wallet a promotion replaced: queues a move for every user it still backs, reports how far that is, and retires it once nothing is left. */
@singleton()
export class FundingWalletDrainService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletMoveRepository: FundingWalletMoveRepository,
    private readonly fundingWalletMoveService: FundingWalletMoveService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentRepository: DeploymentRepository,
    private readonly authzHttpService: AuthzHttpService,
    private readonly jobQueueService: JobQueueService,
    private readonly fundingWalletMoveQueue: FundingWalletMoveQueueService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FundingWalletDrainService.name });
  }

  /** Lists who to move from the chain rather than from the registry, whose row rolls back with its caller while the grant it recorded can still land. */
  async queueMoves(): Promise<FundingWalletMovesQueued> {
    const draining = await this.#findDraining();
    const [grantees, queuedKeys] = await Promise.all([
      this.#findGrantees(draining.address),
      this.jobQueueService.findPendingSingletonKeys(MoveUserToActiveFundingWallet[JOB_NAME])
    ]);
    const startAfter = this.fundingWalletMoveService.lateGrantsEndAt(draining.drainingSince);
    const queued: FundingWalletMovesQueued = { queued: 0, alreadyQueued: 0, withOpenDeployments: 0, unknownGrantees: 0 };

    for (const addresses of chunk(grantees, GRANTEES_PAGE_SIZE)) {
      const [wallets, ownersWithOpenDeployments] = await Promise.all([
        this.userWalletRepository.findByAddresses(addresses),
        this.deploymentRepository.findOwnersWithOpenDeployments(addresses)
      ]);
      queued.unknownGrantees += addresses.length - wallets.length;

      for (const wallet of wallets) {
        const singletonKey = moveUserToActiveFundingWalletKeyFor(draining.network, wallet.id);
        const hasOpenDeployment = ownersWithOpenDeployments.some(owner => owner === wallet.address);

        if (queuedKeys.has(singletonKey)) {
          queued.alreadyQueued += 1;
          continue;
        }

        await this.fundingWalletMoveQueue.queue({
          network: draining.network,
          userWalletId: wallet.id,
          priority: hasOpenDeployment ? FUNDING_WALLET_MOVE_PRIORITY.hasOpenDeployment : FUNDING_WALLET_MOVE_PRIORITY.rest,
          startAfter
        });
        queued.queued += 1;
        queued.withOpenDeployments += hasOpenDeployment ? 1 : 0;
      }
    }

    this.#logger.info({ event: "FUNDING_WALLET_MOVES_QUEUED", address: draining.address, startAfter: startAfter.toISOString(), ...queued });

    return queued;
  }

  async describe(): Promise<FundingWalletDrainStatus> {
    const status = await this.#readStatus(await this.#findDraining());

    this.#logger.info({ event: "FUNDING_WALLET_DRAIN_STATUS", ...status });

    return status;
  }

  /** Refused while the chain shows a grant of the wallet, or could still come to show one signed before the promotion: its user would read as never assigned, get a grant from the active wallet too, and hold a balance on both. */
  async retire(address: string): Promise<FundingWalletDrainStatus> {
    const draining = await this.#findDraining();

    if (draining.address !== address) {
      throw createError(409, `Funding wallet ${address} is not the one draining, ${draining.address} is`, { network: draining.network });
    }

    const status = await this.#readStatus(draining);

    if (new Date() < new Date(status.lateGrantsEndAt)) {
      throw createError(503, "A grant signed before the promotion can still land on the draining funding wallet", { retryAt: status.lateGrantsEndAt });
    }

    const unfinishedMoves = UNFINISHED_MOVE_STATUSES.reduce((count, moveStatus) => count + (status.moves[moveStatus] ?? 0), 0);

    if (status.depositGrantsLeft > 0 || status.feeAllowancesLeft > 0 || unfinishedMoves > 0) {
      throw createError(409, `Funding wallet ${address} still backs users`, { ...status, unfinishedMoves });
    }

    await this.fundingWalletRepository.updateStatus(draining.id, "retired");
    this.#logger.info({ event: "FUNDING_WALLET_RETIRED", ...status });

    return status;
  }

  async #findDraining(): Promise<DrainingWallet> {
    const network = this.coreConfigService.get("NETWORK");
    const draining = await this.fundingWalletRepository.findDraining(network);

    if (!draining) throw createError(409, "No funding wallet is draining", { network });

    return draining;
  }

  async #readStatus(draining: DrainingWallet): Promise<FundingWalletDrainStatus> {
    const [depositGrants, feeAllowances, moves] = await Promise.all([
      this.authzHttpService.getPaginatedDepositDeploymentGrants({ granter: draining.address, limit: 1, offset: 0 }),
      this.authzHttpService.getPaginatedFeeAllowancesForGranter(draining.address, 1, 0),
      this.fundingWalletMoveRepository.countByStatus(draining.id)
    ]);

    return {
      address: draining.address,
      lateGrantsEndAt: this.fundingWalletMoveService.lateGrantsEndAt(draining.drainingSince).toISOString(),
      depositGrantsLeft: depositGrants.pagination.total,
      feeAllowancesLeft: feeAllowances.pagination.total,
      moves
    };
  }

  /** A user wallet can hold a deposit grant, a fee allowance or both, and either one alone has to be moved. */
  async #findGrantees(granter: string): Promise<string[]> {
    const depositGrants = await this.authzHttpService.getAllDepositDeploymentGrants({ granter, limit: GRANTEES_PAGE_SIZE });
    const grantees = new Set(depositGrants.map(({ grantee }) => grantee));
    let offset = 0;
    let total: number;

    do {
      const page = await this.authzHttpService.getPaginatedFeeAllowancesForGranter(granter, GRANTEES_PAGE_SIZE, offset);

      for (const { grantee } of page.allowances) grantees.add(grantee);
      total = page.pagination.total;
      offset += GRANTEES_PAGE_SIZE;
    } while (offset < total);

    return [...grantees];
  }
}
