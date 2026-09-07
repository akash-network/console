import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { type UserInput, UserRepository } from "@src/user/repositories";
import { createAkashAddress } from "../akash-address.seeder";

type UserWalletInsert = ApiPgTables["UserWallets"]["$inferInsert"];

export async function seedUser(overrides: UserInput = {}) {
  return await container.resolve(UserRepository).create(overrides);
}

export async function seedUserWithWallet({ user: userOverrides, ...overrides }: Omit<Partial<UserWalletInsert>, "userId"> & { user?: UserInput } = {}) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const user = await seedUser(userOverrides);
  const [wallet] = await db
    .insert(resolveTable("UserWallets"))
    .values({
      userId: user.id,
      address: createAkashAddress(),
      deploymentAllowance: "10000000",
      feeAllowance: "5000000",
      isTrialing: false,
      ...overrides
    })
    .returning();

  return { user, wallet, address: wallet.address as string };
}
