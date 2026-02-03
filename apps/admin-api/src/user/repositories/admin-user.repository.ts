import { count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { inject, singleton } from "tsyringe";

import { POSTGRES_DB } from "@src/db/dbConnection";
import * as schema from "@src/db/schema";

export interface UserWithWallet {
  id: string;
  userId: string | null;
  username: string | null;
  email: string | null;
  emailVerified: boolean;
  stripeCustomerId: string | null;
  lastActiveAt: Date | null;
  createdAt: Date | null;
  walletAddress: string | null;
  isTrialing: boolean | null;
  deploymentAllowance: string | null;
  feeAllowance: string | null;
}

export interface PaginatedUsers {
  users: UserWithWallet[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserStats {
  totalUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeUsersLast30Days: number;
}

@singleton()
export class AdminUserRepository {
  constructor(@inject(POSTGRES_DB) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async listUsers(page: number = 1, pageSize: number = 20): Promise<PaginatedUsers> {
    const offset = (page - 1) * pageSize;

    const users = await this.db
      .select({
        id: schema.Users.id,
        userId: schema.Users.userId,
        username: schema.Users.username,
        email: schema.Users.email,
        emailVerified: schema.Users.emailVerified,
        stripeCustomerId: schema.Users.stripeCustomerId,
        lastActiveAt: schema.Users.lastActiveAt,
        createdAt: schema.Users.createdAt,
        walletAddress: schema.UserWallets.address,
        isTrialing: schema.UserWallets.isTrialing,
        deploymentAllowance: schema.UserWallets.deploymentAllowance,
        feeAllowance: schema.UserWallets.feeAllowance
      })
      .from(schema.Users)
      .leftJoin(schema.UserWallets, eq(schema.Users.id, schema.UserWallets.userId))
      .orderBy(desc(schema.Users.createdAt))
      .limit(pageSize)
      .offset(offset);

    const [{ total }] = await this.db.select({ total: count() }).from(schema.Users);

    return {
      users,
      total,
      page,
      pageSize
    };
  }

  async searchUsers(query: string, page: number = 1, pageSize: number = 20): Promise<PaginatedUsers> {
    const offset = (page - 1) * pageSize;
    const searchPattern = `%${query}%`;

    const users = await this.db
      .select({
        id: schema.Users.id,
        userId: schema.Users.userId,
        username: schema.Users.username,
        email: schema.Users.email,
        emailVerified: schema.Users.emailVerified,
        stripeCustomerId: schema.Users.stripeCustomerId,
        lastActiveAt: schema.Users.lastActiveAt,
        createdAt: schema.Users.createdAt,
        walletAddress: schema.UserWallets.address,
        isTrialing: schema.UserWallets.isTrialing,
        deploymentAllowance: schema.UserWallets.deploymentAllowance,
        feeAllowance: schema.UserWallets.feeAllowance
      })
      .from(schema.Users)
      .leftJoin(schema.UserWallets, eq(schema.Users.id, schema.UserWallets.userId))
      .where(
        or(
          ilike(schema.Users.email, searchPattern),
          ilike(schema.Users.username, searchPattern),
          ilike(schema.Users.userId, searchPattern),
          ilike(schema.UserWallets.address, searchPattern)
        )
      )
      .orderBy(desc(schema.Users.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Count matching users
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.Users)
      .leftJoin(schema.UserWallets, eq(schema.Users.id, schema.UserWallets.userId))
      .where(
        or(
          ilike(schema.Users.email, searchPattern),
          ilike(schema.Users.username, searchPattern),
          ilike(schema.Users.userId, searchPattern),
          ilike(schema.UserWallets.address, searchPattern)
        )
      );

    return {
      users,
      total,
      page,
      pageSize
    };
  }

  async getUserById(id: string): Promise<UserWithWallet | null> {
    const [user] = await this.db
      .select({
        id: schema.Users.id,
        userId: schema.Users.userId,
        username: schema.Users.username,
        email: schema.Users.email,
        emailVerified: schema.Users.emailVerified,
        stripeCustomerId: schema.Users.stripeCustomerId,
        lastActiveAt: schema.Users.lastActiveAt,
        createdAt: schema.Users.createdAt,
        walletAddress: schema.UserWallets.address,
        isTrialing: schema.UserWallets.isTrialing,
        deploymentAllowance: schema.UserWallets.deploymentAllowance,
        feeAllowance: schema.UserWallets.feeAllowance
      })
      .from(schema.Users)
      .leftJoin(schema.UserWallets, eq(schema.Users.id, schema.UserWallets.userId))
      .where(eq(schema.Users.id, id))
      .limit(1);

    return user || null;
  }

  async getUserStats(): Promise<UserStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [stats] = await this.db
      .select({
        totalUsers: count(),
        newUsersLast7Days: count(sql`CASE WHEN ${schema.Users.createdAt} > ${sevenDaysAgo} THEN 1 END`),
        newUsersLast30Days: count(sql`CASE WHEN ${schema.Users.createdAt} > ${thirtyDaysAgo} THEN 1 END`),
        activeUsersLast30Days: count(sql`CASE WHEN ${schema.Users.lastActiveAt} > ${thirtyDaysAgo} THEN 1 END`)
      })
      .from(schema.Users);

    return {
      totalUsers: stats.totalUsers,
      newUsersLast7Days: stats.newUsersLast7Days,
      newUsersLast30Days: stats.newUsersLast30Days,
      activeUsersLast30Days: stats.activeUsersLast30Days
    };
  }
}
