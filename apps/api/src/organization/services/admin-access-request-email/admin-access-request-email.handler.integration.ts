import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { AdminAccessRequestEmailHandler, AdminAccessRequestEmailJob } from "./admin-access-request-email.handler";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(AdminAccessRequestEmailHandler)]);

describe(AdminAccessRequestEmailHandler.name, () => {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const members = resolveTable("OrganizationMembers");

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emails the owner who wants to be an admin, run the way a worker runs it", async () => {
    const { organization, owner, requester, createNotificationOnce, runRequest } = await setup({ requesterRole: "viewer" });

    await runRequest();

    expect(createNotificationOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: `adminAccessRequest.${organization.id}.${requester.id}.${owner.id}.2026-10-26T12:00:00.000Z`,
        user: { id: owner.id, email: owner.email },
        payload: expect.objectContaining({
          summary: `${requester.username} wants to be an admin of ${organization.name}`,
          description: expect.stringContaining("They're a viewer today."),
          actions: [
            {
              label: "Review members",
              url: `${container.resolve(DeploymentConfigService).get("DEPLOY_WEB_BASE_URL")}/members?org=${organization.id}`
            }
          ]
        })
      })
    );
  });

  it.each<OrganizationRole>(["owner", "admin"])("sends nothing once the requester became %s", async role => {
    const { requesterMembership, createNotificationOnce, runRequest } = await setup({});
    await db.update(members).set({ role }).where(eq(members.id, requesterMembership.id));

    await runRequest();

    expect(createNotificationOnce).not.toHaveBeenCalled();
  });

  it("sends nothing once the requester left the organization", async () => {
    const { requesterMembership, createNotificationOnce, runRequest } = await setup({});
    await db.delete(members).where(eq(members.id, requesterMembership.id));

    await runRequest();

    expect(createNotificationOnce).not.toHaveBeenCalled();
  });

  it("sends nothing to an owner who stepped down", async () => {
    const { ownerMembership, createNotificationOnce, runRequest } = await setup({});
    await db.update(members).set({ role: "admin" }).where(eq(members.id, ownerMembership.id));

    await runRequest();

    expect(createNotificationOnce).not.toHaveBeenCalled();
  });

  it("sends nothing to an owner without an email", async () => {
    const { createNotificationOnce, runRequest } = await setup({ ownerEmail: null });

    await runRequest();

    expect(createNotificationOnce).not.toHaveBeenCalled();
  });

  it("sends nothing once the organization is deleted", async () => {
    const { organization, createNotificationOnce, runRequest } = await setup({});
    const organizations = resolveTable("Organizations");
    await db.update(organizations).set({ deletedAt: new Date() }).where(eq(organizations.id, organization.id));

    await runRequest();

    expect(createNotificationOnce).not.toHaveBeenCalled();
  });

  async function setup(input: { requesterRole?: OrganizationRole; ownerEmail?: string | null }) {
    const ownerEmail = input.ownerEmail === undefined ? faker.internet.email() : input.ownerEmail;
    const { organization, user: owner, membership: ownerMembership } = await seedOrganizationWithOwner({ user: { email: ownerEmail } });
    const requester = await seedUser({ username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const requesterMembership = await seedOrganizationMember({ organizationId: organization.id, userId: requester.id, role: input.requesterRole ?? "member" });
    const createNotificationOnce = vi.spyOn(container.resolve(NotificationService), "createNotificationOnce").mockResolvedValue(undefined);

    const runRequest = async () => {
      const { enqueue, startWorkers } = await jobWorkers();
      await enqueue(
        new AdminAccessRequestEmailJob({
          organizationId: organization.id,
          requesterUserId: requester.id,
          ownerUserId: owner.id,
          requestedAt: "2026-10-26T12:00:00.000Z"
        })
      );
      await startWorkers();
      await expectJobCompleted(AdminAccessRequestEmailJob[JOB_NAME], { data: { requesterUserId: requester.id, ownerUserId: owner.id } });
    };

    return { organization, owner, ownerMembership, requester, requesterMembership, createNotificationOnce, runRequest };
  }
});
