import { AuthzHttpService, type DepositDeploymentGrant } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import {
  type BalanceSnapshotGrant,
  type BalanceSnapshotOutput,
  BalanceSnapshotRepository
} from "@src/billing/repositories/balance-snapshot/balance-snapshot.repository";
import { FundingWalletRepository } from "@src/billing/repositories/funding-wallet/funding-wallet.repository";
import { FundingWalletRegistryService } from "@src/billing/services/funding-wallet-registry/funding-wallet-registry.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

const GRANTS_PAGE_SIZE = 500;

export type BalanceSnapshotTaken = { network: string; takenOn: string; height: number; grants: number; isAlreadyComplete: boolean };

/** Keeps a daily copy of every user balance, which lives only as a grant on chain and can be rewritten by whoever holds the funding key. */
@singleton()
export class BalanceSnapshotService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly balanceSnapshotRepository: BalanceSnapshotRepository,
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletRegistry: FundingWalletRegistryService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly blockHttpService: BlockHttpService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: BalanceSnapshotService.name });
  }

  /** A day already complete is left as it is, so a retry or a second run can never replace a good snapshot with a later state. */
  async take(takenOn: string): Promise<BalanceSnapshotTaken> {
    const network = this.coreConfigService.get("NETWORK");
    const height = await this.blockHttpService.getFreshCurrentHeight();
    const snapshot = await this.balanceSnapshotRepository.startUnlessComplete({ network, takenOn, height });

    if (!snapshot) return await this.#describeComplete({ network, takenOn });

    try {
      const grants = await this.#storeGrants(snapshot);
      await this.balanceSnapshotRepository.complete(snapshot.id, grants);

      const taken = { network, takenOn, height, grants, isAlreadyComplete: false };
      this.#logger.info({ event: "BALANCE_SNAPSHOT_TAKEN", ...taken });

      return taken;
    } catch (error) {
      await this.balanceSnapshotRepository.fail(snapshot.id, error instanceof Error ? error.message : String(error));
      this.#logger.error({ event: "BALANCE_SNAPSHOT_FAILED", network, takenOn, height, error });

      throw error;
    }
  }

  async #describeComplete(day: { network: string; takenOn: string }): Promise<BalanceSnapshotTaken> {
    const complete = await this.balanceSnapshotRepository.findByDay(day);
    const taken = { ...day, height: complete?.height ?? 0, grants: complete?.grantsCount ?? 0, isAlreadyComplete: true };

    this.#logger.info({ event: "BALANCE_SNAPSHOT_ALREADY_TAKEN", ...taken });

    return taken;
  }

  async #storeGrants(snapshot: BalanceSnapshotOutput): Promise<number> {
    let stored = 0;

    for (const granter of await this.#findGranters(snapshot.network)) {
      let offset = 0;
      let total: number;

      do {
        const page = await this.authzHttpService.getPaginatedDepositDeploymentGrants({ granter, limit: GRANTS_PAGE_SIZE, offset, height: snapshot.height });
        const grants = page.grants.flatMap(grant => this.#balancesOf(granter, grant));

        await this.balanceSnapshotRepository.addGrants(snapshot.id, grants);
        stored += grants.length;
        total = page.pagination.total;
        offset += GRANTS_PAGE_SIZE;
      } while (offset < total);
    }

    return stored;
  }

  /** A grant can name one denom twice, once in each of the two fields the chain has used for limits, and the first is the one the balance read shows. */
  #balancesOf(granter: string, grant: DepositDeploymentGrant): BalanceSnapshotGrant[] {
    const amountByDenom = new Map<string, number>();

    for (const { denom, amount } of grant.authorization.spend_limits) {
      if (!amountByDenom.has(denom)) amountByDenom.set(denom, parseInt(amount, 10));
    }

    return [...amountByDenom].map(([denom, amount]) => ({ granter, grantee: grant.grantee, denom, amount }));
  }

  /** Users hold grants from the active wallet and, while a rotation runs, from the one draining; a retired wallet backs none. */
  async #findGranters(network: string): Promise<string[]> {
    const [active, draining] = await Promise.all([this.fundingWalletRegistry.getActiveAddress(), this.fundingWalletRepository.findDraining(network)]);

    return draining ? [active, draining.address] : [active];
  }
}
