import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { LoggerService } from "@src/core";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import type { DryRunOptions } from "@src/core/types/console";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";

export interface DeploymentSettingsBackfillSummary {
  scannedWallets: number;
  openDeployments: number;
  missingSettings: number;
  createdSettings: number;
}

/**
 * One-off backfill for CON-895: deployments created outside the web app before settings rows were
 * written eagerly have no deployment_settings row, so the funding sweep never sees them. Walks every
 * managed wallet, diffs its open-lease dseqs from the chain database against its settings rows, and
 * creates the missing rows on the repository defaults. A dry run only counts, which doubles as the
 * measurement of the affected population before the sweep is widened.
 */
@singleton()
export class DeploymentSettingsBackfillService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly leaseRepository: LeaseRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly logger: LoggerService
  ) {}

  async backfillDeploymentSettings({ dryRun }: DryRunOptions): Promise<DeploymentSettingsBackfillSummary> {
    const summary: DeploymentSettingsBackfillSummary = {
      scannedWallets: 0,
      openDeployments: 0,
      missingSettings: 0,
      createdSettings: 0
    };

    await this.userWalletRepository.paginate({ limit: 100 }, async wallets => {
      for (const wallet of wallets) {
        if (!wallet.address || !wallet.userId) {
          continue;
        }

        summary.scannedWallets++;
        await this.backfillWallet({ userId: wallet.userId, address: wallet.address }, { dryRun }, summary);
      }
    });

    this.logger.info({ event: "DEPLOYMENT_SETTINGS_BACKFILL_COMPLETED", dryRun, ...summary });

    return summary;
  }

  private async backfillWallet(
    wallet: { userId: string; address: string },
    { dryRun }: DryRunOptions,
    summary: DeploymentSettingsBackfillSummary
  ): Promise<void> {
    const openDseqs = await this.leaseRepository.findOpenDseqsByOwner(wallet.address);

    if (!openDseqs.length) {
      return;
    }

    summary.openDeployments += openDseqs.length;

    const settings = await this.deploymentSettingRepository.find({ userId: wallet.userId }, { select: ["dseq"] });
    const knownDseqs = new Set(settings.map(setting => setting.dseq));
    const missingDseqs = openDseqs.filter(dseq => !knownDseqs.has(dseq));

    if (!missingDseqs.length) {
      return;
    }

    summary.missingSettings += missingDseqs.length;
    this.logger.info({ event: "DEPLOYMENT_SETTINGS_MISSING", dryRun, userId: wallet.userId, address: wallet.address, dseqs: missingDseqs });

    if (dryRun) {
      return;
    }

    for (const dseq of missingDseqs) {
      await this.createSetting(wallet.userId, dseq, summary);
    }
  }

  /**
   * A unique violation means the row appeared between the diff and the insert (the detail page's lazy
   * create or the lease-start funding path), which is the backfill's goal already reached, not an error.
   */
  private async createSetting(userId: string, dseq: string, summary: DeploymentSettingsBackfillSummary): Promise<void> {
    try {
      await this.deploymentSettingRepository.create({ userId, dseq });
      summary.createdSettings++;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
}
