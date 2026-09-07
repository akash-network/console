import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";

type DeploymentSettingInsert = ApiPgTables["DeploymentSettings"]["$inferInsert"];

export async function seedDeploymentSetting(overrides: Partial<DeploymentSettingInsert> & Pick<DeploymentSettingInsert, "userId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [setting] = await db
    .insert(resolveTable("DeploymentSettings"))
    .values({
      dseq: faker.number.int({ min: 100000, max: 999999 }).toString(),
      autoTopUpEnabled: true,
      ...overrides
    })
    .returning();

  return setting;
}
