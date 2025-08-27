import { singleton } from "tsyringe";

import { StripeCouponRepository, StripeTransactionRepository } from "@src/billing/repositories";
import { UsageService } from "@src/billing/services/usage/usage.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import type { NewUserSnapshot } from "@src/user/model-schemas/user/user-snapshot.schema";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { UserSnapshotRepository } from "@src/user/repositories/user-snapshot/user-snapshot.repository";

@singleton()
export class UserSnapshotService {
  private readonly logger = LoggerService.forContext(UserSnapshotService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userSnapshotRepository: UserSnapshotRepository,
    private readonly usageService: UsageService,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly stripeCouponRepository: StripeCouponRepository
  ) {}

  /**
   * Take a snapshot of spending metrics for all users
   */
  async takeUserSpendingSnapshot(): Promise<{
    totalUsers: number;
    snapshotsCreated: number;
    errors: number;
  }> {
    this.logger.info({ event: "USER_SNAPSHOT_JOB_STARTED" });

    const startTime = Date.now();
    let snapshotsCreated = 0;
    let errors = 0;
    let totalUsers = 0;

    try {
      // Process users using pagination (same pattern as TopUpManagedDeploymentsService)
      // paginateAll already filters for users with wallets that have addresses
      for await (const users of this.userRepository.paginateAll({ limit: 50 })) {
        totalUsers += users.length;

        // Process each batch of users
        const results = await Promise.allSettled(
          users.map(async user => {
            try {
              // Wallet address is already included in the pagination results
              await this.takeSnapshotForUser(user.id, user.walletAddress);
              return { success: true, userId: user.id };
            } catch (error) {
              this.logger.error({
                event: "USER_SNAPSHOT_ERROR",
                userId: user.id,
                error: error instanceof Error ? error.message : String(error)
              });
              return { success: false, userId: user.id, error };
            }
          })
        );

        // Count successes and errors
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            snapshotsCreated++;
          } else {
            errors++;
          }
        }

        // Log progress every 10 batches (500 users)
        if (totalUsers % 500 === 0) {
          this.logger.info({
            event: "USER_SNAPSHOT_JOB_PROGRESS",
            processed: totalUsers,
            snapshotsCreated,
            errors
          });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        event: "USER_SNAPSHOT_JOB_COMPLETED",
        totalUsers,
        snapshotsCreated,
        errors,
        durationMs: duration
      });

      return { totalUsers, snapshotsCreated, errors };
    } catch (error) {
      this.logger.error({
        event: "USER_SNAPSHOT_JOB_FAILED",
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Take a snapshot for a specific user
   */
  async takeSnapshotForUser(userId: string, walletAddress: string | null): Promise<void> {
    try {
      // Get all the spending data for the user
      const [totalSpend, totalCreditPurchases, couponsClaimed, activeLeasesCount, usageData] = await Promise.all([
        this.getTotalSpend(walletAddress),
        this.getTotalCreditPurchases(userId),
        this.getCouponsClaimed(userId),
        this.getActiveLeasesCount(walletAddress),
        this.getUsageData(walletAddress)
      ]);

      // Create snapshot
      const snapshot: NewUserSnapshot = {
        userId,
        totalSpend: totalSpend.toString(),
        totalCreditPurchases,
        couponsClaimed,
        activeLeasesCount,
        totalAktSpent: usageData.totalAktSpent.toString(),
        totalUsdcSpent: usageData.totalUsdcSpent.toString(),
        totalUsdSpent: usageData.totalUsdSpent.toString()
      };

      await this.userSnapshotRepository.createSnapshot(snapshot);
    } catch (error) {
      this.logger.error({
        event: "USER_SNAPSHOT_ERROR",
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get the latest snapshot for a user
   */
  async getLatestSnapshot(userId: string) {
    return this.userSnapshotRepository.getLatestSnapshotByUserId(userId);
  }

  /**
   * Get historical snapshots for a user
   */
  async getHistoricalSnapshots(userId: string, limit = 10) {
    return this.userSnapshotRepository.getSnapshotsByUserId(userId, limit);
  }

  /**
   * Clean up old snapshots (keep last 30 days by default)
   */
  async cleanupOldSnapshots(olderThanDays = 30): Promise<number> {
    const deletedCount = await this.userSnapshotRepository.deleteOldSnapshots(olderThanDays);

    this.logger.info({
      event: "USER_SNAPSHOT_CLEANUP_COMPLETED",
      deletedCount,
      olderThanDays
    });

    return deletedCount;
  }

  // Helper methods (same as AdminUserDataService)
  private async getTotalSpend(walletAddress: string | null): Promise<number> {
    if (!walletAddress) return 0;

    try {
      const usageData = await this.getUsageData(walletAddress);
      return usageData.totalUsdSpent;
    } catch (error) {
      this.logger.error({ event: "GET_TOTAL_SPEND_ERROR", error, walletAddress });
      return 0;
    }
  }

  private async getTotalCreditPurchases(userId: string): Promise<number> {
    try {
      // Use internal transaction table instead of querying Stripe
      const transactions = await this.stripeTransactionRepository.findByUserId(userId);
      return transactions.filter(tx => tx.status === "succeeded").length;
    } catch (error) {
      this.logger.error({ event: "GET_TOTAL_CREDIT_PURCHASES_ERROR", error, userId });
      return 0;
    }
  }

  private async getCouponsClaimed(userId: string): Promise<number> {
    try {
      // Use internal coupon table instead of querying Stripe
      const coupons = await this.stripeCouponRepository.findByUserId(userId);
      return coupons.length;
    } catch (error) {
      this.logger.error({ event: "GET_COUPONS_CLAIMED_ERROR", error, userId });
      return 0;
    }
  }

  private async getActiveLeasesCount(walletAddress: string | null): Promise<number> {
    if (!walletAddress) return 0;

    try {
      return await this.usageService.getActiveLeasesCount(walletAddress);
    } catch (error) {
      this.logger.error({ event: "GET_ACTIVE_LEASES_COUNT_ERROR", error, walletAddress });
      return 0;
    }
  }

  private async getUsageData(walletAddress: string | null): Promise<{
    totalAktSpent: number;
    totalUsdcSpent: number;
    totalUsdSpent: number;
  }> {
    if (!walletAddress) {
      return { totalAktSpent: 0, totalUsdcSpent: 0, totalUsdSpent: 0 };
    }

    try {
      return await this.usageService.getTotalUsageData(walletAddress);
    } catch (error) {
      this.logger.error({ event: "GET_USAGE_DATA_ERROR", error, walletAddress });
      return { totalAktSpent: 0, totalUsdcSpent: 0, totalUsdSpent: 0 };
    }
  }
}
