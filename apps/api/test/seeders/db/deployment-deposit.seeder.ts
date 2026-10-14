import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { createAkashAddress } from "../akash-address.seeder";
import { createDseq } from "./deployment-setting.seeder";

type DeploymentDepositInsert = ApiPgTables["DeploymentDeposits"]["$inferInsert"];

export async function seedDeploymentDeposit(overrides: Partial<DeploymentDepositInsert> & Pick<DeploymentDepositInsert, "organizationId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const amountCents = overrides.amountCents ?? faker.number.int({ min: 1, max: 10_000 });
  const [deposit] = await db
    .insert(resolveTable("DeploymentDeposits"))
    .values({
      owner: createAkashAddress(),
      dseq: createDseq(),
      kind: "top_up",
      amount: String(amountCents * 10_000),
      denom: "uact",
      amountCents,
      status: "confirmed",
      ...overrides
    })
    .returning();

  return deposit;
}

export async function findDeploymentDeposit(id: string) {
  const deposits = resolveTable("DeploymentDeposits");
  const [deposit] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(deposits).where(eq(deposits.id, id));

  return deposit;
}

export async function findDeploymentDepositsOf(organizationId: string) {
  const deposits = resolveTable("DeploymentDeposits");

  return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(deposits).where(eq(deposits.organizationId, organizationId));
}
