import { singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { UserSnapshotService } from "@src/user/services/user-snapshot/user-snapshot.service";

export interface UserSnapshotOptions {
  days?: number;
}

@singleton()
export class UserSnapshotController {
  private readonly logger = LoggerService.forContext(UserSnapshotController.name);

  constructor(private readonly userSnapshotService: UserSnapshotService) {}

  /**
   * Take snapshots of user spending metrics for all users
   */
  async takeUserSpendingSnapshot(): Promise<void> {
    this.logger.info({ event: "USER_SNAPSHOT_CONTROLLER_STARTED" });

    try {
      const result = await this.userSnapshotService.takeUserSpendingSnapshot();

      this.logger.info({
        event: "USER_SNAPSHOT_CONTROLLER_COMPLETED",
        totalUsers: result.totalUsers,
        snapshotsCreated: result.snapshotsCreated,
        errors: result.errors
      });

      console.log(`✅ User snapshot completed: ${result.snapshotsCreated} snapshots created, ${result.errors} errors`);
    } catch (error) {
      this.logger.error({
        event: "USER_SNAPSHOT_CONTROLLER_FAILED",
        error: error instanceof Error ? error.message : String(error)
      });

      console.error("❌ User snapshot failed:", error);
      throw error;
    }
  }

  /**
   * Clean up old user snapshots
   */
  async cleanupOldSnapshots(options: UserSnapshotOptions = {}): Promise<void> {
    const { days = 30 } = options;

    this.logger.info({
      event: "USER_SNAPSHOT_CLEANUP_CONTROLLER_STARTED",
      keepDays: days
    });

    try {
      const deletedCount = await this.userSnapshotService.cleanupOldSnapshots(days);

      this.logger.info({
        event: "USER_SNAPSHOT_CLEANUP_CONTROLLER_COMPLETED",
        deletedCount,
        keepDays: days
      });

      console.log(`✅ Cleanup completed: ${deletedCount} old snapshots deleted (keeping last ${days} days)`);
    } catch (error) {
      this.logger.error({
        event: "USER_SNAPSHOT_CLEANUP_CONTROLLER_FAILED",
        error: error instanceof Error ? error.message : String(error)
      });

      console.error("❌ Snapshot cleanup failed:", error);
      throw error;
    }
  }
}
