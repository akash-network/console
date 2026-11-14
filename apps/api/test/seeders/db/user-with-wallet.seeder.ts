import { container } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { type UserInput, type UserOutput, UserRepository } from "@src/user/repositories";
import { createAkashAddress } from "../akash-address.seeder";

type UserWalletInsert = ApiPgTables["UserWallets"]["$inferInsert"];

export async function seedUser(overrides: UserInput = {}) {
  return await container.resolve(UserRepository).create(overrides);
}

export async function seedPersonalOrganizationOf(user: Pick<UserOutput, "id" | "username">) {
  return await container.resolve(PersonalOrganizationService).ensureForUser(user);
}

export async function seedPersonalOrganizationIdOf(userId: string) {
  const user = await container.resolve(UserRepository).findById(userId);
  if (!user) throw new Error(`Seed user ${userId} before seeding their personal organization`);

  return (await seedPersonalOrganizationOf(user)).id;
}

export async function seedOwnWalletOf(userId: string, address = createAkashAddress()) {
  const userWalletRepository = container.resolve(UserWalletRepository);
  await seedPersonalOrganizationIdOf(userId);
  const { wallet } = await userWalletRepository.getOrCreate({ userId });

  return await userWalletRepository.updateById(wallet.id, { address }, { returning: true });
}

export async function seedUserWithWallet({ user: userOverrides, ...overrides }: Omit<Partial<UserWalletInsert>, "userId"> & { user?: UserInput } = {}) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const user = await seedUser(userOverrides);
  const organizationId = "organizationId" in overrides ? overrides.organizationId : (await seedPersonalOrganizationOf(user)).id;
  const [wallet] = await db
    .insert(resolveTable("UserWallets"))
    .values({
      userId: user.id,
      organizationId,
      address: createAkashAddress(),
      deploymentAllowance: "10000000",
      feeAllowance: "5000000",
      isTrialing: false,
      ...overrides
    })
    .returning();

  return { user, wallet: { ...wallet, userId: user.id }, address: wallet.address as string };
}

export async function seedOrganizationWallet(overrides: Omit<Partial<UserWalletInsert>, "userId"> & Pick<UserWalletInsert, "organizationId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [wallet] = await db
    .insert(resolveTable("UserWallets"))
    .values({
      userId: null,
      address: createAkashAddress(),
      deploymentAllowance: "10000000",
      feeAllowance: "5000000",
      isTrialing: false,
      ...overrides
    })
    .returning();

  return { ...wallet, address: wallet.address as string };
}
