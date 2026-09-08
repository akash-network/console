import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type WalletSettingInsert = ApiPgTables["WalletSetting"]["$inferInsert"];

export async function seedWalletSetting(overrides: Partial<WalletSettingInsert> & Pick<WalletSettingInsert, "userId" | "walletId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [setting] = await db.insert(resolveTable("WalletSetting")).values(overrides).returning();

  return setting;
}
