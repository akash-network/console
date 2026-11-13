import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type WalletSettingInsert = ApiPgTables["WalletSetting"]["$inferInsert"];

export async function seedWalletSetting({ organizationId, ...overrides }: Partial<WalletSettingInsert> & Pick<WalletSettingInsert, "userId" | "walletId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [setting] = await db
    .insert(resolveTable("WalletSetting"))
    .values({ organizationId: organizationId ?? (await organizationIdOfWallet(overrides.walletId)), ...overrides })
    .returning();

  return setting;
}

async function organizationIdOfWallet(walletId: number) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const UserWallets = resolveTable("UserWallets");
  const [wallet] = await db.select({ organizationId: UserWallets.organizationId }).from(UserWallets).where(eq(UserWallets.id, walletId));
  if (!wallet?.organizationId) throw new Error(`Seed wallet ${walletId} into an organization before seeding its settings`);

  return wallet.organizationId;
}
