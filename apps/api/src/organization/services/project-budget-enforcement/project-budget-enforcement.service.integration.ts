import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { budgetPeriodOf } from "@src/organization/lib/budget-period/budget-period";
import { ProjectBudgetAlert, ProjectBudgetAlertHandler } from "@src/organization/services/project-budget-alert/project-budget-alert.handler";
import { type BudgetedDeposit, ProjectBudgetEnforcementService, ProjectBudgetExceededError } from "./project-budget-enforcement.service";

import { findDeploymentDepositsOf, seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobQueue = useJobWorkers(() => [container.resolve(ProjectBudgetAlertHandler)]);

describe(ProjectBudgetEnforcementService.name, () => {
  it("lets exactly one of two concurrent creates through when the budget fits only one", async () => {
    const { enforceAndRecord, organization, project } = await setup({ monthlyAmountCents: 1000 });
    await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 400, status: "confirmed" });

    const outcomes = await Promise.allSettled([
      enforceAndRecord(createDeposit(organization.id, project.id, 500)),
      enforceAndRecord(createDeposit(organization.id, project.id, 500))
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(outcomes.find(({ status }) => status === "rejected")).toMatchObject({ reason: expect.any(ProjectBudgetExceededError) });
    expect((await findDeploymentDepositsOf(organization.id)).map(({ amountCents }) => amountCents).sort()).toEqual([400, 500]);
  });

  it("counts pending deposits and leaves voided ones and those of past months out", async () => {
    const { enforceAndRecord, organization, project } = await setup({ monthlyAmountCents: 1000 });
    const lastMonth = new Date(budgetPeriodOf(new Date()).from.getTime() - 1);
    await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 600, status: "pending" });
    await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 5000, status: "void" });
    await seedDeploymentDeposit({ organizationId: organization.id, projectId: project.id, amountCents: 5000, createdAt: lastMonth });

    await expect(enforceAndRecord(createDeposit(organization.id, project.id, 400))).resolves.toHaveLength(1);
    await expect(enforceAndRecord(createDeposit(organization.id, project.id, 1))).rejects.toBeInstanceOf(ProjectBudgetExceededError);
  });

  it("marks the month and queues one alert per owner and admin, which a refusal does not roll back", async () => {
    const { enforceAndRecord, organization, project, owner, budgetId } = await setup({ monthlyAmountCents: 1000 });
    const admin = await seedUser();
    await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" });
    await seedOrganizationMember({ organizationId: organization.id, userId: (await seedUser()).id, role: "member" });

    await expect(enforceAndRecord(createDeposit(organization.id, project.id, 2000))).rejects.toBeInstanceOf(ProjectBudgetExceededError);

    const alerts = await findJobRows<{ userId: string; projectId: string }>(ProjectBudgetAlert[JOB_NAME], { data: { projectId: project.id } });
    expect(alerts.map(({ data }) => data.userId).sort()).toEqual([owner.id, admin.id].sort());
    expect(await budgetRow(budgetId)).toMatchObject({ alertedForPeriod: budgetPeriodOf(new Date()).key });
    expect(await findDeploymentDepositsOf(organization.id)).toEqual([]);
  });

  async function budgetRow(id: string) {
    const budgets = resolveTable("ProjectBudgets");
    const [row] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(budgets).where(eq(budgets.id, id));

    return row;
  }

  function createDeposit(organizationId: string, projectId: string, amountCents: number): BudgetedDeposit & { owner: string; amount: string; denom: string } {
    return { organizationId, projectId, dseq: faker.string.numeric(10), kind: "deployment_create", amountCents, owner: "akash1owner", amount: String(amountCents * 10_000), denom: "uact" };
  }

  async function setup(input: { monthlyAmountCents: number }) {
    await jobQueue();
    const { organization, user: owner } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const [budget] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("ProjectBudgets"))
      .values({ organizationId: organization.id, projectId: project.id, monthlyAmountCents: input.monthlyAmountCents })
      .returning();
    const service = container.resolve(ProjectBudgetEnforcementService);
    const deposits = container.resolve(DeploymentDepositRepository);

    const enforceAndRecord = (deposit: ReturnType<typeof createDeposit>) => service.enforce([deposit], () => deposits.createMany([deposit]));

    return { enforceAndRecord, organization, project, owner, budgetId: budget.id };
  }
});
