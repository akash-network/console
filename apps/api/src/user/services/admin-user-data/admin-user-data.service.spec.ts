import { mock } from "jest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { UsageService } from "@src/billing/services/usage/usage.service";
import type { UserRepository } from "@src/user/repositories/user/user.repository";
import { AdminUserDataService } from "./admin-user-data.service";

describe("AdminUserDataService", () => {
  it("should return paginated user data with all required fields", async () => {
    const mockUsers = [
      {
        id: "user-1",
        userId: "auth0|123456",
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
        createdAt: new Date("2024-01-01"),
        lastActiveAt: new Date("2024-01-15"),
        lastIp: null,
        lastFingerprint: null,
        trial: false
      }
    ];

    const mockUserWallets = [
      {
        id: "wallet-1",
        userId: "user-1",
        address: "akash1abc123",
        deploymentAllowance: "100.00",
        feeAllowance: "10.00",
        isTrialing: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const { service } = setup({
      users: mockUsers,
      userWallets: mockUserWallets,
      stripeTransactions: [],
      activeLeasesCount: 2,
      usageData: {
        totalAktSpent: 10.5,
        totalUsdcSpent: 25,
        totalUsdSpent: 35.5
      }
    });

    const result = await service.getAdminUserData({
      page: 1,
      limit: 20
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      id: "user-1",
      userId: "auth0|123456",
      email: "test@example.com",
      walletAddress: "akash1abc123",
      totalSpend: 35.5,
      totalCreditPurchases: 0,
      couponsClaimed: 0,
      activeLeasesCount: 2,
      totalAktSpent: 10.5,
      totalUsdcSpent: 25,
      totalUsdSpent: 35.5,
      createdAt: new Date("2024-01-01"),
      lastActiveAt: new Date("2024-01-15")
    });
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1
    });
  });

  it("should handle search parameter", async () => {
    const mockUsers = [
      {
        id: "user-1",
        userId: "auth0|123456",
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
        createdAt: new Date(),
        lastActiveAt: new Date(),
        lastIp: null,
        lastFingerprint: null,
        trial: false
      },
      {
        id: "user-2",
        userId: "auth0|789012",
        email: "other@example.com",
        stripeCustomerId: "cus_test456",
        createdAt: new Date(),
        lastActiveAt: new Date(),
        lastIp: null,
        lastFingerprint: null,
        trial: false
      }
    ];

    const mockUserWallets = [
      {
        id: "wallet-1",
        userId: "user-1",
        address: "akash1abc123",
        deploymentAllowance: "100.00",
        feeAllowance: "10.00",
        isTrialing: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const { service } = setup({
      users: mockUsers,
      userWallets: mockUserWallets,
      stripeTransactions: [],
      activeLeasesCount: 0,
      usageData: {
        totalAktSpent: 0,
        totalUsdcSpent: 0,
        totalUsdSpent: 0
      }
    });

    const result = await service.getAdminUserData({
      page: 1,
      limit: 20,
      search: "test@example.com"
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].email).toBe("test@example.com");
    expect(result.pagination.total).toBe(1);
  });

  it("should handle users without wallet addresses", async () => {
    const mockUsers = [
      {
        id: "user-1",
        userId: "auth0|123456",
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
        createdAt: new Date(),
        lastActiveAt: new Date(),
        lastIp: null,
        lastFingerprint: null,
        trial: false
      }
    ];

    const { service } = setup({
      users: mockUsers,
      userWallets: [], // No wallet for this user
      stripeTransactions: [],
      activeLeasesCount: 0,
      usageData: {
        totalAktSpent: 0,
        totalUsdcSpent: 0,
        totalUsdSpent: 0
      }
    });

    const result = await service.getAdminUserData({
      page: 1,
      limit: 20
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].walletAddress).toBeNull();
    expect(result.data[0].totalSpend).toBe(0);
    expect(result.data[0].activeLeasesCount).toBe(0);
  });

  it("should calculate credit purchases and coupons from Stripe", async () => {
    const mockUsers = [
      {
        id: "user-1",
        userId: "auth0|123456",
        email: "test@example.com",
        stripeCustomerId: "cus_test123",
        createdAt: new Date(),
        lastActiveAt: new Date(),
        lastIp: null,
        lastFingerprint: null,
        trial: false
      }
    ];

    const mockUserWallets = [
      {
        id: "wallet-1",
        userId: "user-1",
        address: "akash1abc123",
        deploymentAllowance: "100.00",
        feeAllowance: "10.00",
        isTrialing: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    const mockStripeTransactions = [
      { status: "succeeded", amount: 5000, metadata: {} },
      { status: "succeeded", amount: 3000, metadata: { discount_applied: "true" } },
      { status: "failed", amount: 2000, metadata: {} }
    ];

    const { service } = setup({
      users: mockUsers,
      userWallets: mockUserWallets,
      stripeTransactions: mockStripeTransactions,
      activeLeasesCount: 0,
      usageData: {
        totalAktSpent: 0,
        totalUsdcSpent: 0,
        totalUsdSpent: 0
      }
    });

    const result = await service.getAdminUserData({
      page: 1,
      limit: 20
    });

    expect(result.data[0].totalCreditPurchases).toBe(2); // 2 successful transactions
    expect(result.data[0].couponsClaimed).toBe(1); // 1 transaction with discount
  });

  function setup(input: {
    users: any[];
    userWallets: any[];
    stripeTransactions: any[];
    activeLeasesCount: number;
    usageData: { totalAktSpent: number; totalUsdcSpent: number; totalUsdSpent: number };
  }) {
    const userRepository = mock<UserRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const stripeService = mock<StripeService>();
    const usageService = mock<UsageService>();

    // Mock user repository
    userRepository.find.mockResolvedValue(input.users);

    // Mock user wallet repository
    userWalletRepository.find.mockResolvedValue(input.userWallets);

    // Mock Stripe service
    stripeService.getCustomerTransactions.mockResolvedValue({
      transactions: input.stripeTransactions,
      hasMore: false,
      nextPage: null,
      prevPage: null
    });

    // Mock usage service
    usageService.getActiveLeasesCount.mockResolvedValue(input.activeLeasesCount);
    usageService.getTotalUsageData.mockResolvedValue(input.usageData);

    const service = new AdminUserDataService(userWalletRepository, userRepository, stripeService, usageService);

    return {
      service,
      userRepository,
      userWalletRepository,
      stripeService,
      usageService
    };
  }
});
