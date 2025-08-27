import { desc, eq, lt } from "drizzle-orm";
import { singleton } from "tsyringe";

import { type ApiPgDatabase, InjectPg, InjectPgTable } from "@src/core/providers";
import { type AbilityParams, BaseRepository } from "@src/core/repositories/base.repository";
import { TxService } from "@src/core/services";
import { type NewUserSnapshot, type UserSnapshot, userSnapshot } from "@src/user/model-schemas/user/user-snapshot.schema";

@singleton()
export class UserSnapshotRepository extends BaseRepository<typeof userSnapshot, NewUserSnapshot, UserSnapshot> {
  constructor(
    @InjectPg() protected readonly pg: ApiPgDatabase,
    @InjectPgTable("Users") protected readonly table: typeof userSnapshot,
    protected readonly txManager: TxService
  ) {
    super(pg, table, txManager, "UserSnapshot", "Users");
  }

  accessibleBy(...abilityParams: AbilityParams) {
    return new UserSnapshotRepository(this.pg, this.table, this.txManager).withAbility(...abilityParams) as this;
  }

  async createSnapshot(snapshot: NewUserSnapshot): Promise<UserSnapshot> {
    const [result] = await this.cursor.insert(this.table).values(snapshot).returning();
    return this.toOutput(result);
  }

  async getLatestSnapshotByUserId(userId: string): Promise<UserSnapshot | null> {
    const [result] = await this.cursor.select().from(this.table).where(eq(this.table.userId, userId)).orderBy(desc(this.table.snapshotDate)).limit(1);

    return result ? this.toOutput(result) : null;
  }

  async getSnapshotsByUserId(userId: string, limit = 10): Promise<UserSnapshot[]> {
    const results = await this.cursor.select().from(this.table).where(eq(this.table.userId, userId)).orderBy(desc(this.table.snapshotDate)).limit(limit);
    return this.toOutputList(results);
  }

  async deleteOldSnapshots(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.cursor.delete(this.table).where(lt(this.table.snapshotDate, cutoffDate));
    return result.length || 0;
  }

  /**
   * Get paginated users with their latest snapshot data, sorted by spending
   * This is the optimized query for the admin dashboard
   */
  async getLatestSnapshotsPaginated(
    offset: number,
    limit: number,
    sortBy: "totalSpend" | "createdAt" | "lastActiveAt" = "totalSpend",
    sortOrder: "asc" | "desc" = "desc"
  ): Promise<{
    users: Array<{
      userId: string;
      totalSpend: number;
      totalCreditPurchases: number;
      couponsClaimed: number;
      activeLeasesCount: number;
      totalAktSpent: number;
      totalUsdcSpent: number;
      totalUsdSpent: number;
      snapshotDate: Date;
    }>;
    total: number;
  }> {
    // For now, use a simpler approach until we can properly register the table
    const allSnapshots = await this.cursor.select().from(this.table);

    // Group by user_id and get the latest snapshot for each
    const latestSnapshots = new Map<string, UserSnapshot>();
    for (const snapshot of allSnapshots) {
      const existing = latestSnapshots.get(snapshot.userId);
      if (!existing || snapshot.snapshotDate > existing.snapshotDate) {
        latestSnapshots.set(snapshot.userId, this.toOutput(snapshot));
      }
    }

    // Convert to array and sort
    const sortedSnapshots = Array.from(latestSnapshots.values()).sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case "totalSpend":
          aValue = parseFloat(a.totalSpend);
          bValue = parseFloat(b.totalSpend);
          break;
        default:
          aValue = a.snapshotDate.getTime();
          bValue = b.snapshotDate.getTime();
      }

      return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
    });

    // Apply pagination
    const paginatedSnapshots = sortedSnapshots.slice(offset, offset + limit);

    const users = paginatedSnapshots.map(snapshot => ({
      userId: snapshot.userId,
      totalSpend: parseFloat(snapshot.totalSpend),
      totalCreditPurchases: snapshot.totalCreditPurchases,
      couponsClaimed: snapshot.couponsClaimed,
      activeLeasesCount: snapshot.activeLeasesCount,
      totalAktSpent: parseFloat(snapshot.totalAktSpent),
      totalUsdcSpent: parseFloat(snapshot.totalUsdcSpent),
      totalUsdSpent: parseFloat(snapshot.totalUsdSpent),
      snapshotDate: snapshot.snapshotDate
    }));

    return { users, total: latestSnapshots.size };
  }
}
