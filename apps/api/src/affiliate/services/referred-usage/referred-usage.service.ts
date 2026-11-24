import { isBefore } from "date-fns";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

const MICRO_USD_PER_CENT = 10_000;

@singleton()
export class ReferredUsageService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentSpendRepository: DeploymentSpendRepository
  ) {}

  /** Counts lease cost not yet settled too, so a deployment still running counts for what it has run so far. */
  async hasConsumedAtLeast(referredUserId: string, { since, until }: { since: Date; until: Date }, minCents: number): Promise<boolean> {
    const owners = await this.#findPayerWalletAddresses(referredUserId);
    if (!owners.length) return false;

    const consumption = await this.deploymentSpendRepository.findConsumedByDeployment({
      owners,
      startDate: toUtcDay(since),
      endDate: toUtcDay(until)
    });
    const consumedMicroUsd = consumption.reduce((total, { settledMicroUsd, accruedMicroUsd }) => total + Number(settledMicroUsd) + Number(accruedMicroUsd), 0);

    return consumedMicroUsd / MICRO_USD_PER_CENT >= minCents;
  }

  /** Usage counts in whole UTC days, so only a processed block from the next day shows the day of `at` is fully counted. */
  async isIndexedThroughUtcDayOf(at: Date): Promise<boolean> {
    const latestProcessedBlockTime = await this.deploymentSpendRepository.findLatestProcessedBlockTime();
    return !!latestProcessedBlockTime && !isBefore(latestProcessedBlockTime, startOfNextUtcDay(at));
  }

  /** The same payers commission counts: the referred user's personal organization and the teams they created. */
  async #findPayerWalletAddresses(referredUserId: string): Promise<string[]> {
    const organizations = await this.organizationRepository.find({ createdByUserId: referredUserId });
    const wallets = await Promise.all(organizations.map(({ id }) => this.userWalletRepository.findOneByOrganizationId(id)));

    return wallets.flatMap(wallet => (wallet?.address ? [wallet.address] : []));
  }
}

function startOfNextUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}

function toUtcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
