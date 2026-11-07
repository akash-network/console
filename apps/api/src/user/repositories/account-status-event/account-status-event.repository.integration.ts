import { faker } from "@faker-js/faker";
import { subMinutes } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import type { AccountStatusAction } from "@src/user/lib/account-status/account-status";
import { AccountStatusEventRepository } from "./account-status-event.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(AccountStatusEventRepository.name, () => {
  describe("findLatestUserReasonOf", () => {
    it("returns the reason of the latest suspension or termination, skipping a later reinstatement", async () => {
      const { repository, user, record } = await setup();
      await record({ action: "suspend", userReason: "First suspension", minutesAgo: 30 });
      await record({ action: "reinstate", userReason: null, minutesAgo: 20 });
      await record({ action: "suspend", userReason: "Second suspension", minutesAgo: 10 });
      await record({ action: "reinstate", userReason: null, minutesAgo: 5 });

      expect(await repository.findLatestUserReasonOf(user.id)).toBe("Second suspension");
    });

    it("returns the reason of a termination that followed a suspension", async () => {
      const { repository, user, record } = await setup();
      await record({ action: "suspend", userReason: "Suspended", minutesAgo: 10 });
      await record({ action: "terminate", userReason: "Terminated", minutesAgo: 5 });

      expect(await repository.findLatestUserReasonOf(user.id)).toBe("Terminated");
    });

    it("returns null for a user with no suspension or termination", async () => {
      const { repository, user, record } = await setup();
      await record({ action: "reinstate", userReason: null, minutesAgo: 5 });

      expect(await repository.findLatestUserReasonOf(user.id)).toBeNull();
    });

    it("ignores another user's events", async () => {
      const { repository, user } = await setup();
      const other = await setup();
      await other.record({ action: "suspend", userReason: "Someone else", minutesAgo: 5 });

      expect(await repository.findLatestUserReasonOf(user.id)).toBeNull();
    });
  });

  describe("findLatestVerifiedTerminationOf", () => {
    it("finds the latest termination of an address verified at the time, whatever its case and padding", async () => {
      const { repository, user } = await setup();
      const domain = `${faker.string.alphanumeric(12).toLowerCase()}.com`;
      const terminate = (userReason: string, minutesAgo: number) =>
        repository.create({
          userId: user.id,
          userEmail: `Jane@${domain}`,
          action: "terminate",
          actorEmail: faker.internet.email(),
          actorName: faker.person.fullName(),
          userReason,
          options: { forfeitCredits: false, emailVerified: true },
          createdAt: subMinutes(new Date(), minutesAgo)
        });
      await terminate("Older", 10);
      await terminate("Fraud", 5);

      await expect(repository.findLatestVerifiedTerminationOf(` JANE@${domain.toUpperCase()} `)).resolves.toEqual({ userId: user.id, userReason: "Fraud" });
    });

    it("ignores a termination of an unverified address and an event that is not a termination", async () => {
      const { repository, user } = await setup();
      const email = faker.internet.email();
      const event = { userId: user.id, userEmail: email, actorEmail: faker.internet.email(), actorName: faker.person.fullName(), userReason: "Fraud" };
      await repository.create({ ...event, action: "terminate", options: { forfeitCredits: false, emailVerified: false } });
      await repository.create({ ...event, action: "terminate", options: { forfeitCredits: false } });
      await repository.create({ ...event, action: "suspend", options: { closeDeployments: false, emailVerified: true } });

      await expect(repository.findLatestVerifiedTerminationOf(email)).resolves.toBeUndefined();
    });
  });

  describe("findManyByUserId", () => {
    it("lists only the user's events, newest first", async () => {
      const { repository, user, record } = await setup();
      const oldest = await record({ action: "suspend", userReason: "Abuse", minutesAgo: 30 });
      const newest = await record({ action: "suspend", userReason: "Abuse again", minutesAgo: 5 });
      const middle = await record({ action: "reinstate", userReason: null, minutesAgo: 20 });
      await (await setup()).record({ action: "suspend", userReason: "Someone else", minutesAgo: 1 });

      const events = await repository.findManyByUserId(user.id);

      expect(events.map(({ id }) => id)).toEqual([newest.id, middle.id, oldest.id]);
    });
  });

  describe("markNotificationSent", () => {
    it("stamps when the event's email went out, leaving other events alone", async () => {
      const { repository, user, record } = await setup();
      const notified = await record({ action: "suspend", userReason: "Abuse", minutesAgo: 10 });
      const other = await record({ action: "reinstate", userReason: null, minutesAgo: 5 });

      await repository.markNotificationSent(notified.id);

      const events = await repository.findManyByUserId(user.id);
      expect(events.find(({ id }) => id === notified.id)?.notificationSentAt).toBeInstanceOf(Date);
      expect(events.find(({ id }) => id === other.id)?.notificationSentAt).toBeNull();
    });
  });

  it("keeps the history of a user whose account is deleted, without the user", async () => {
    const { db, repository, user, record } = await setup();
    const event = await record({ action: "suspend", userReason: "Abuse", minutesAgo: 5 });

    await db.delete(resolveTable("Users")).where(eq(resolveTable("Users").id, user.id));

    const [kept] = await db
      .select()
      .from(resolveTable("AccountStatusEvents"))
      .where(eq(resolveTable("AccountStatusEvents").id, event.id));
    expect(kept).toMatchObject({ userId: null, userEmail: user.email, userReason: "Abuse" });
    expect(await repository.findManyByUserId(user.id)).toEqual([]);
  });

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const repository = container.resolve(AccountStatusEventRepository);
    const user = await seedUser({ email: faker.internet.email() });

    async function record(input: { action: AccountStatusAction; userReason: string | null; minutesAgo: number }) {
      return await repository.create({
        userId: user.id,
        userEmail: user.email,
        action: input.action,
        actorEmail: faker.internet.email(),
        actorName: faker.person.fullName(),
        userReason: input.userReason,
        createdAt: subMinutes(new Date(), input.minutesAgo)
      });
    }

    return { db, repository, user, record };
  }
});
