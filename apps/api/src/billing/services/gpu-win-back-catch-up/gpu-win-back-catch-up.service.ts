import { addDays, max, subDays } from "date-fns";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { GpuWinBackService, WIN_BACK_GPU_IDLE_DAYS } from "@src/billing/services/gpu-win-back/gpu-win-back.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentRepository, type GpuDeploymentOwner } from "@src/deployment/repositories/deployment/deployment.repository";

export const WIN_BACK_CATCH_UP_LOOKBACK_DAYS = 30;
const WALLET_LOOKUP_BATCH_SIZE = 1000;

interface WinBackCandidate {
  userId: string;
  checkAt: Date;
}

/** A gpu deployment leased before the win-back launched queued no check, so this queues one for the people who deployed recently. */
@singleton()
export class GpuWinBackCatchUpService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly gpuWinBackService: GpuWinBackService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWinBackCatchUpService.name });
  }

  async run({ dryRun, now }: { dryRun: boolean; now: Date }): Promise<{ scheduled: number }> {
    const owners = await this.deploymentRepository.findGpuDeploymentOwnersSince(subDays(now, WIN_BACK_CATCH_UP_LOOKBACK_DAYS));
    const candidates = await this.#findPeopleAmong(owners, now);
    const scheduled = dryRun ? candidates.length : await this.#scheduleChecks(candidates);

    this.#logger.info({ event: "GPU_WIN_BACK_CATCH_UP", scheduled, dryRun });

    return { scheduled };
  }

  async #findPeopleAmong(owners: GpuDeploymentOwner[], now: Date): Promise<WinBackCandidate[]> {
    const personByAddress = await this.#findPersonByWalletAddress(owners.map(({ owner }) => owner));

    return owners.flatMap(({ owner, latestGpuDeploymentCreatedAt }) => {
      const userId = personByAddress.get(owner);

      return userId ? [{ userId, checkAt: max([now, addDays(latestGpuDeploymentCreatedAt, WIN_BACK_GPU_IDLE_DAYS)]) }] : [];
    });
  }

  async #findPersonByWalletAddress(addresses: string[]): Promise<Map<string | null, string | null>> {
    const wallets = this.userWalletRepository.unscoped("gpu-win-back-catch-up");
    const personByAddress = new Map<string | null, string | null>();

    for (const batch of chunk(addresses, WALLET_LOOKUP_BATCH_SIZE)) {
      for (const { address, userId } of await wallets.findByAddresses(batch)) personByAddress.set(address, userId);
    }

    return personByAddress;
  }

  async #scheduleChecks(candidates: WinBackCandidate[]): Promise<number> {
    let scheduled = 0;

    for (const { userId, checkAt } of candidates) {
      if (await this.gpuWinBackService.scheduleCheck(userId, checkAt)) scheduled += 1;
    }

    return scheduled;
  }
}
