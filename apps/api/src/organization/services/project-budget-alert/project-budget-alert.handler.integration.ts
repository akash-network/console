import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { ProjectBudgetAlert, ProjectBudgetAlertHandler } from "./project-budget-alert.handler";

import { seedOrganizationWithOwner, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ProjectBudgetAlertHandler)]);

describe(ProjectBudgetAlertHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the recipient the project's budget alert, run the way a worker runs it", async () => {
    const { owner, project, createNotification, runAlert } = await setup({ withBudget: true });

    await runAlert({ userId: owner.id, committedCents: 85_000, refusedCents: 0 });

    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: expect.stringContaining(`projectBudgetAlert.${project.id}.`),
        user: { id: owner.id, email: owner.email },
        payload: expect.objectContaining({
          summary: `Project ${project.name} has committed 85% of its monthly budget`,
          actions: [
            {
              label: "View project",
              url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/projects/${project.id}?org=${project.organizationId}`
            }
          ]
        })
      })
    );
  });

  it("sends nothing once the budget is gone", async () => {
    const { owner, createNotification, runAlert } = await setup({ withBudget: false });

    await runAlert({ userId: owner.id, committedCents: 1, refusedCents: 0 });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it("sends nothing to a recipient without an email", async () => {
    const { createNotification, runAlert } = await setup({ withBudget: true });
    const withoutEmail = await seedUser({ email: null });

    await runAlert({ userId: withoutEmail.id, committedCents: 1, refusedCents: 0 });

    expect(createNotification).not.toHaveBeenCalled();
  });

  async function setup(input: { withBudget: boolean }) {
    const { organization, user: owner } = await seedOrganizationWithOwner({ user: { email: faker.internet.email() } });
    const project = await seedProject({ organizationId: organization.id });

    if (input.withBudget) {
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .insert(resolveTable("ProjectBudgets"))
        .values({ organizationId: organization.id, projectId: project.id, monthlyAmountCents: 100_000 });
    }

    const createNotification = vi.spyOn(container.resolve(NotificationService), "createNotification").mockResolvedValue(undefined);

    const runAlert = async (alert: { userId: string; committedCents: number; refusedCents: number }) => {
      const { enqueue, startWorkers } = await jobWorkers();
      await enqueue(new ProjectBudgetAlert({ ...alert, organizationId: organization.id, projectId: project.id, period: "2026-10-01" }));
      await startWorkers();
      await expectJobCompleted(ProjectBudgetAlert[JOB_NAME], { data: { userId: alert.userId, projectId: project.id } });
    };

    return { owner, project, createNotification, runAlert };
  }
});
