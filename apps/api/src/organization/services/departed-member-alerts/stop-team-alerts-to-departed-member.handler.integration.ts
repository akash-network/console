import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import {
  STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS,
  StopTeamAlertsToDepartedMember,
  StopTeamAlertsToDepartedMemberHandler
} from "./stop-team-alerts-to-departed-member.handler";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(StopTeamAlertsToDepartedMemberHandler)]);

describe(StopTeamAlertsToDepartedMemberHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("has the notifications service take the address off the team's channels, handing emptied ones to the owners with an email", async () => {
    const { organization, owner, stopAlerts, releaseRequests } = await setup({ notificationsStatus: 204 });
    const ownerWithoutEmail = await seedUser({ email: null });
    await seedOrganizationMember({ organizationId: organization.id, userId: ownerWithoutEmail.id, role: "owner" });
    const admin = await seedUser({ email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" });

    const job = await stopAlerts();
    await expectJobCompleted(StopTeamAlertsToDepartedMember[JOB_NAME], { data: { organizationId: organization.id } });

    expect(releaseRequests()).toEqual([{ data: { addressSha256: job.addressSha256, fallbackAddresses: [owner.email] } }]);
  });

  it("hands emptied channels to every member with an email when no owner has one", async () => {
    const { organization, stopAlerts, releaseRequests } = await setup({ notificationsStatus: 204, ownerEmail: null });
    const admin = await seedUser({ email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: admin.id, role: "admin" });
    const viewer = await seedUser({ email: faker.internet.email() });
    await seedOrganizationMember({ organizationId: organization.id, userId: viewer.id, role: "viewer" });

    const job = await stopAlerts();
    await expectJobCompleted(StopTeamAlertsToDepartedMember[JOB_NAME], { data: { organizationId: organization.id } });

    expect(releaseRequests()).toEqual([{ data: { addressSha256: job.addressSha256, fallbackAddresses: [admin.email, viewer.email] } }]);
  });

  it("keeps the job for a retry while the notifications service cannot take it", async () => {
    const { organization, stopAlerts } = await setup({ notificationsStatus: 404 });

    await stopAlerts();

    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(StopTeamAlertsToDepartedMember[JOB_NAME], { data: { organizationId: organization.id } });
        expect(row).toMatchObject({ state: "retry", retry_limit: STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS.retryLimit });
      },
      { timeout: 20_000, interval: 250 }
    );
  });

  async function setup(input: { notificationsStatus: number; ownerEmail?: string | null }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const ownerEmail = input.ownerEmail === undefined ? faker.internet.email() : input.ownerEmail;
    const { organization, user: owner } = await seedOrganizationWithOwner({ user: { email: ownerEmail } });
    const requests: unknown[] = [];

    nock(container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string)
      .persist()
      .post(`/internal/v1/organizations/${organization.id}/departed-members`)
      .reply((_uri, body) => {
        requests.push(body);
        return [input.notificationsStatus, input.notificationsStatus === 204 ? "" : { message: "Cannot POST" }];
      });

    const stopAlerts = async () => {
      const data = {
        organizationId: organization.id,
        userId: faker.string.uuid(),
        addressSha256: faker.string.hexadecimal({ length: 64, prefix: "", casing: "lower" })
      };
      await enqueue(new StopTeamAlertsToDepartedMember(data), STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS);
      await startWorkers();

      return data;
    };

    return { organization, owner, stopAlerts, releaseRequests: () => requests };
  }
});
