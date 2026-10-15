import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JOB_NAME } from "@src/core";
import { NOTIFICATIONS_CONFIG } from "@src/notifications/providers/notifications-config.provider";
import { TeamOrganizationDeleted, TeamOrganizationDeletedHandler } from "./team-organization-deleted.handler";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const STRIPE_API = "https://api.stripe.com";
const NOTIFICATION_PATH = "/internal/v1/jobs/notification";
const CLEANUP_JOB = TeamOrganizationDeleted[JOB_NAME];

const jobWorkers = useJobWorkers(() => [container.resolve(TeamOrganizationDeletedHandler)]);

type SentNotification = { userId: string | undefined; body: { notificationId: string; payload: { summary: string; description: string } } };

describe(TeamOrganizationDeletedHandler.name, () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("detaches the team's saved cards and emails every member with an email, the owner who deleted it included", async () => {
    const { team, owner, billingMember, customerId, answerNotifications, run } = await setup();
    const listed = nock(STRIPE_API)
      .get("/v1/payment_methods")
      .query({ customer: customerId, limit: "100" })
      .reply(200, {
        object: "list",
        data: [
          { id: "pm_1", object: "payment_method" },
          { id: "pm_2", object: "payment_method" }
        ],
        has_more: false
      });
    const detached = nock(STRIPE_API)
      .post("/v1/payment_methods/pm_1/detach")
      .reply(200, { id: "pm_1", object: "payment_method" })
      .post("/v1/payment_methods/pm_2/detach")
      .reply(200, { id: "pm_2", object: "payment_method" });
    const notifications = answerNotifications();

    await run({ organizationId: team.id, deletedByUserId: owner.id });

    expect(listed.isDone()).toBe(true);
    expect(detached.isDone()).toBe(true);
    expect(notifications).toHaveLength(2);
    expect(notifications).toEqual(
      expect.arrayContaining(
        [owner, billingMember].map(member => ({
          userId: member.id,
          body: expect.objectContaining({
            notificationId: `teamOrganizationDeleted.${team.id}.${member.id}`,
            payload: expect.objectContaining({
              summary: `${team.name} was deleted on Akash Console`,
              description: expect.stringContaining(`${owner.username} deleted the team`)
            })
          })
        }))
      )
    );
  });

  it("only emails the members of a team that never set up payments", async () => {
    const { owner, answerNotifications, run } = await setup();
    const team = await seedOrganization({ deletedAt: new Date() });
    await seedOrganizationMember({ organizationId: team.id, userId: owner.id, role: "owner" });
    const notifications = answerNotifications();

    await run({ organizationId: team.id, deletedByUserId: owner.id });

    expect(notifications).toEqual([expect.objectContaining({ userId: owner.id })]);
  });

  it("completes without detaching or emailing anything for a team that is not deleted", async () => {
    const { owner, answerNotifications, run } = await setup();
    const team = await seedOrganization({ stripeCustomerId: `cus_${faker.string.alphanumeric(14)}` });
    await seedOrganizationMember({ organizationId: team.id, userId: owner.id, role: "owner" });
    const notifications = answerNotifications();

    await run({ organizationId: team.id, deletedByUserId: owner.id });

    expect(notifications).toEqual([]);
  });

  it("retries a failed card removal, while the members are already told", async () => {
    const { team, owner, customerId, answerNotifications, startCleanup } = await setup();
    nock(STRIPE_API)
      .persist()
      .get("/v1/payment_methods")
      .query({ customer: customerId, limit: "100" })
      .reply(500, { error: { type: "api_error" } });
    const notifications = answerNotifications();

    await startCleanup({ organizationId: team.id, deletedByUserId: owner.id });
    await vi.waitFor(
      async () => {
        const [row] = await findJobRows(CLEANUP_JOB, { data: { organizationId: team.id } });
        expect(row.state).toBe("retry");
      },
      { timeout: 20_000, interval: 250 }
    );

    expect(notifications).toHaveLength(2);
  });

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const notificationsBaseUrl = container.resolve(NOTIFICATIONS_CONFIG).NOTIFICATIONS_API_BASE_URL as string;
    const customerId = `cus_${faker.string.alphanumeric(14)}`;
    const owner = await seedUser({ userId: faker.string.uuid(), username: `owner-${faker.string.alphanumeric(8)}`, email: faker.internet.email() });
    const billingMember = await seedUser({ userId: faker.string.uuid(), email: faker.internet.email() });
    const memberWithoutEmail = await seedUser({ userId: faker.string.uuid(), email: null });
    const team = await seedOrganization({ stripeCustomerId: customerId, deletedAt: new Date() });
    await seedOrganizationMember({ organizationId: team.id, userId: owner.id, role: "owner" });
    await seedOrganizationMember({ organizationId: team.id, userId: billingMember.id, role: "billing" });
    await seedOrganizationMember({ organizationId: team.id, userId: memberWithoutEmail.id, role: "viewer" });

    function answerNotifications() {
      const sent: SentNotification[] = [];
      nock(notificationsBaseUrl)
        .persist()
        .post(NOTIFICATION_PATH)
        .reply(function reply(this: nock.ReplyFnContext, _uri, body) {
          sent.push({ userId: this.req.headers["x-user-id"] as string | undefined, body: body as SentNotification["body"] });
          return [204];
        });

      return sent;
    }

    async function startCleanup(data: TeamOrganizationDeleted["data"]) {
      await enqueue(new TeamOrganizationDeleted(data));
      await startWorkers();
    }

    async function run(data: TeamOrganizationDeleted["data"]) {
      await startCleanup(data);
      await expectJobCompleted(CLEANUP_JOB, { data: { organizationId: data.organizationId } });
    }

    return { team, owner, billingMember, customerId, answerNotifications, startCleanup, run };
  }
});
