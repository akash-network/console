import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { UsageService } from "@src/billing/services/usage/usage.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { UserSnapshotRepository } from "@src/user/repositories/user-snapshot/user-snapshot.repository";

export interface AdminUserData {
  id: string;
  userId: string | null;
  email: string | null;
  walletAddress: string | null;
  totalSpend: number;
  totalCreditPurchases: number;
  couponsClaimed: number;
  activeLeasesCount: number;
  totalAktSpent: number;
  totalUsdcSpent: number;
  totalUsdSpent: number;
  createdAt: Date | null;
  lastActiveAt: Date | null;
}

export interface AdminUserDataQuery {
  page: number;
  limit: number;
  sortBy?: "totalSpend" | "createdAt" | "lastActiveAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminUserDataResponse {
  data: AdminUserData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@singleton()
export class AdminUserDataService {
  private readonly logger = LoggerService.forContext(AdminUserDataService.name);

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly userSnapshotRepository: UserSnapshotRepository,
    private readonly stripeService: StripeService,
    private readonly usageService: UsageService
  ) {}

  async getAdminUserData(query: AdminUserDataQuery): Promise<AdminUserDataResponse> {
    const { page, limit, sortBy = "totalSpend", sortOrder = "desc" } = query;
    const offset = (page - 1) * limit;

    try {
      // Get paginated users with their latest snapshot data, sorted by spending
      const { users: snapshotUsers, total } = await this.userSnapshotRepository.getLatestSnapshotsPaginated(offset, limit, sortBy, sortOrder);

      // Get user details for the snapshot users
      const userIds = snapshotUsers.map(u => u.userId);
      const users = await Promise.all(userIds.map(id => this.userRepository.findById(id)));
      const userMap = new Map(users.filter(Boolean).map(u => [u!.id, u!]));

      // Get wallet addresses for these users
      const userWallets = await this.userWalletRepository.find();
      const walletMap = new Map(userWallets.map(wallet => [wallet.userId, wallet.address]));

      // Combine snapshot data with user details
      const userData = snapshotUsers.map(snapshotUser => {
        const user = userMap.get(snapshotUser.userId);
        const walletAddress = walletMap.get(snapshotUser.userId) || null;

        return {
          id: snapshotUser.userId,
          userId: user?.userId || snapshotUser.userId,
          email: user?.email || null,
          walletAddress,
          totalSpend: snapshotUser.totalSpend,
          totalCreditPurchases: snapshotUser.totalCreditPurchases,
          couponsClaimed: snapshotUser.couponsClaimed,
          activeLeasesCount: snapshotUser.activeLeasesCount,
          totalAktSpent: snapshotUser.totalAktSpent,
          totalUsdcSpent: snapshotUser.totalUsdcSpent,
          totalUsdSpent: snapshotUser.totalUsdSpent,
          createdAt: user?.createdAt || null,
          lastActiveAt: user?.lastActiveAt || null
        };
      });

      return {
        data: userData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error({
        event: "ADMIN_USER_DATA_ERROR",
        error: error instanceof Error ? error.message : String(error),
        fallbackToRealTime: true
      });

      // Fallback to the old method if snapshot query fails
      return this.getAdminUserDataFallback(query);
    }
  }

  /**
   * Fallback method using real-time data (old implementation)
   */
  private async getAdminUserDataFallback(query: AdminUserDataQuery): Promise<AdminUserDataResponse> {
    const { page, limit, sortBy = "totalSpend", sortOrder = "desc" } = query;
    const offset = (page - 1) * limit;

    // Get all users (needed for total count and pagination)
    const allUsers = await this.userRepository.find();
    const total = allUsers.length;

    // Apply pagination to limit expensive operations
    const paginatedUsers = allUsers.slice(offset, offset + limit);

    // Get wallet addresses for paginated users only
    const userWallets = await this.userWalletRepository.find();
    const walletMap = new Map(userWallets.map(wallet => [wallet.userId, wallet.address]));

    // Get additional data for paginated users only
    const userDataPromises = paginatedUsers.map(async user => {
      const walletAddress = walletMap.get(user.id) || null;

      // Try to get data from latest snapshot first, fallback to real-time if not available
      const latestSnapshot = await this.userSnapshotRepository.getLatestSnapshotByUserId(user.id);

      let totalSpend = 0;
      let totalCreditPurchases = 0;
      let couponsClaimed = 0;
      let activeLeasesCount = 0;
      let totalAktSpent = 0;
      let totalUsdcSpent = 0;
      let totalUsdSpent = 0;

      if (latestSnapshot) {
        // Use snapshot data
        totalSpend = parseFloat(latestSnapshot.totalSpend);
        totalCreditPurchases = latestSnapshot.totalCreditPurchases;
        couponsClaimed = latestSnapshot.couponsClaimed;
        activeLeasesCount = latestSnapshot.activeLeasesCount;
        totalAktSpent = parseFloat(latestSnapshot.totalAktSpent);
        totalUsdcSpent = parseFloat(latestSnapshot.totalUsdcSpent);
        totalUsdSpent = parseFloat(latestSnapshot.totalUsdSpent);
      } else {
        // Fallback to real-time data
        const [realTimeTotalSpend, realTimeTotalCreditPurchases, realTimeCouponsClaimed, realTimeActiveLeasesCount, usageData] = await Promise.all([
          this.getTotalSpend(walletAddress),
          this.getTotalCreditPurchases(user.id),
          this.getCouponsClaimed(user.id),
          this.getActiveLeasesCount(walletAddress),
          this.getUsageData(walletAddress)
        ]);

        totalSpend = realTimeTotalSpend;
        totalCreditPurchases = realTimeTotalCreditPurchases;
        couponsClaimed = realTimeCouponsClaimed;
        activeLeasesCount = realTimeActiveLeasesCount;
        totalAktSpent = usageData.totalAktSpent;
        totalUsdcSpent = usageData.totalUsdcSpent;
        totalUsdSpent = usageData.totalUsdSpent;
      }

      return {
        id: user.id,
        userId: user.userId,
        email: user.email,
        walletAddress,
        totalSpend,
        totalCreditPurchases,
        couponsClaimed,
        activeLeasesCount,
        totalAktSpent,
        totalUsdcSpent,
        totalUsdSpent,
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt
      };
    });

    const userData = await Promise.all(userDataPromises);

    // Only sort the paginated results (much smaller dataset)
    const sortedUserData = this.sortUserData(userData, sortBy, sortOrder);

    return {
      data: sortedUserData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private async getTotalSpend(walletAddress: string | null): Promise<number> {
    if (!walletAddress) return 0;

    try {
      // Get total USD spent from on-chain data (same as usage data)
      const usageData = await this.getUsageData(walletAddress);
      return usageData.totalUsdSpent;
    } catch (error) {
      this.logger.error({ event: "GET_TOTAL_SPEND_ERROR", error, walletAddress });
      return 0;
    }
  }

  private async getTotalCreditPurchases(userId: string): Promise<number> {
    try {
      // Get user to find stripe customer ID using repository
      const user = await this.userRepository.findById(userId);

      if (!user?.stripeCustomerId) return 0;

      // Get all transactions for the customer
      const { transactions } = await this.stripeService.getCustomerTransactions(user.stripeCustomerId, { limit: 1000 });

      // Count successful transactions (each represents a credit purchase)
      return transactions.filter(tx => tx.status === "succeeded").length;
    } catch (error) {
      this.logger.error({ event: "GET_TOTAL_CREDIT_PURCHASES_ERROR", error, userId });
      return 0;
    }
  }

  private async getCouponsClaimed(userId: string): Promise<number> {
    try {
      // Get user to find stripe customer ID using repository
      const user = await this.userRepository.findById(userId);

      if (!user?.stripeCustomerId) return 0;

      // Get all transactions for the customer
      const { transactions } = await this.stripeService.getCustomerTransactions(user.stripeCustomerId, { limit: 1000 });

      // Count transactions that have discount metadata
      return transactions.filter(tx => tx.status === "succeeded" && tx.metadata && tx.metadata.discount_applied === "true").length;
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

  private sortUserData(userData: AdminUserData[], sortBy: string, sortOrder: string): AdminUserData[] {
    return userData.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case "totalSpend":
          aValue = a.totalSpend;
          bValue = b.totalSpend;
          break;
        case "createdAt":
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case "lastActiveAt":
          aValue = a.lastActiveAt;
          bValue = b.lastActiveAt;
          break;
        default:
          aValue = a.totalSpend;
          bValue = b.totalSpend;
      }

      // Handle null values
      if (aValue === null) aValue = sortOrder === "desc" ? -Infinity : Infinity;
      if (bValue === null) bValue = sortOrder === "desc" ? -Infinity : Infinity;

      if (sortOrder === "desc") {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });
  }
}
