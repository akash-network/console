import { faker } from "@faker-js/faker";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { TxService } from "@src/core/services";
import { TemplateRateLimitRepository } from "./template-rate-limit.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const HOUR = { windowSeconds: 3600 };

describe(TemplateRateLimitRepository.name, () => {
  describe("findSecondsUntilRoom", () => {
    it("finds room while fewer templates than the limit were created in the window", async () => {
      const { repository, user, organization } = await setup();
      await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [5, 10] });

      expect(await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 3, ...HOUR })).toBeUndefined();
      expect(await repository.findSecondsUntilRoom("create", { organizationId: organization.id }, { max: 3, ...HOUR })).toBeUndefined();
    });

    it("answers the seconds until the oldest template counted against the limit leaves the window", async () => {
      const { repository, user, organization } = await setup();
      await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [5, 20, 50] });

      const perUser = await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 3, ...HOUR });
      const perOrganization = await repository.findSecondsUntilRoom("create", { organizationId: organization.id }, { max: 2, ...HOUR });

      expectAbout(perUser, 10 * 60);
      expectAbout(perOrganization, 40 * 60);
    });

    it("counts neither templates older than the window nor those of another author or organization", async () => {
      const { repository, user, organization } = await setup();
      const [otherUser, otherOrganization] = await Promise.all([seedUser(), seedOrganization()]);
      await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [5, 61] });
      await seedTemplates({ authorId: otherUser.id, organizationId: otherOrganization.id, minutesAgo: [1, 2, 3] });

      expect(await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 2, ...HOUR })).toBeUndefined();
      expect(await repository.findSecondsUntilRoom("create", { organizationId: organization.id }, { max: 2, ...HOUR })).toBeUndefined();
    });

    it("counts a user's templates across organizations and an organization's across authors", async () => {
      const { repository, user, organization } = await setup();
      const [otherUser, otherOrganization] = await Promise.all([seedUser(), seedOrganization()]);
      await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [30] });
      await seedTemplates({ authorId: user.id, organizationId: otherOrganization.id, minutesAgo: [10] });
      await seedTemplates({ authorId: otherUser.id, organizationId: organization.id, minutesAgo: [20] });

      expectAbout(await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 2, ...HOUR }), 30 * 60);
      expectAbout(await repository.findSecondsUntilRoom("create", { organizationId: organization.id }, { max: 2, ...HOUR }), 30 * 60);
      expect(await repository.findSecondsUntilRoom("create", { userId: otherUser.id }, { max: 2, ...HOUR })).toBeUndefined();
    });

    it("counts the versions saved after a template's first one, by who saved them and by the template's organization", async () => {
      const { repository, user, organization } = await setup();
      const otherUser = await seedUser();
      const [template] = await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [55] });
      await seedVersions(template.id, [
        { version: 1, createdById: user.id, minutesAgo: 55 },
        { version: 2, createdById: user.id, minutesAgo: 40 },
        { version: 3, createdById: otherUser.id, minutesAgo: 30 },
        { version: 4, createdById: user.id, minutesAgo: 10 }
      ]);

      expectAbout(await repository.findSecondsUntilRoom("version", { userId: user.id }, { max: 2, ...HOUR }), 20 * 60);
      expect(await repository.findSecondsUntilRoom("version", { userId: user.id }, { max: 3, ...HOUR })).toBeUndefined();
      expectAbout(await repository.findSecondsUntilRoom("version", { organizationId: organization.id }, { max: 3, ...HOUR }), 20 * 60);
      expect(await repository.findSecondsUntilRoom("version", { organizationId: organization.id }, { max: 4, ...HOUR })).toBeUndefined();
    });

    it("keeps the versions of another organization's templates out of an organization's count", async () => {
      const { repository, user, organization } = await setup();
      const otherOrganization = await seedOrganization();
      const [template] = await seedTemplates({ authorId: user.id, organizationId: otherOrganization.id, minutesAgo: [55] });
      await seedVersions(template.id, [
        { version: 2, createdById: user.id, minutesAgo: 40 },
        { version: 3, createdById: user.id, minutesAgo: 30 }
      ]);

      expect(await repository.findSecondsUntilRoom("version", { organizationId: organization.id }, { max: 1, ...HOUR })).toBeUndefined();
      expectAbout(await repository.findSecondsUntilRoom("version", { organizationId: otherOrganization.id }, { max: 1, ...HOUR }), 30 * 60);
    });

    it("counts publishes by who accepted the terms and by the organization published under", async () => {
      const { repository, user, organization } = await setup();
      const [otherUser, otherOrganization] = await Promise.all([seedUser(), seedOrganization()]);
      const [template] = await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [55] });
      const [otherTemplate] = await seedTemplates({ authorId: user.id, organizationId: otherOrganization.id, minutesAgo: [55] });
      await seedAcceptances([
        { templateId: template.id, userId: user.id, organizationId: organization.id, minutesAgo: 45 },
        { templateId: template.id, userId: otherUser.id, organizationId: organization.id, minutesAgo: 15 },
        { templateId: otherTemplate.id, userId: user.id, organizationId: otherOrganization.id, minutesAgo: 5 },
        { templateId: template.id, userId: user.id, organizationId: organization.id, minutesAgo: 90 }
      ]);

      expectAbout(await repository.findSecondsUntilRoom("publish", { userId: user.id }, { max: 2, ...HOUR }), 15 * 60);
      expectAbout(await repository.findSecondsUntilRoom("publish", { organizationId: organization.id }, { max: 2, ...HOUR }), 15 * 60);
      expect(await repository.findSecondsUntilRoom("publish", { userId: user.id }, { max: 3, ...HOUR })).toBeUndefined();
      expect(await repository.findSecondsUntilRoom("publish", { organizationId: organization.id }, { max: 3, ...HOUR })).toBeUndefined();
    });

    it("counts with a window other than an hour", async () => {
      const { repository, user, organization } = await setup();
      await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [5, 20] });

      expect(await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 2, windowSeconds: 10 * 60 })).toBeUndefined();
      expectAbout(await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 1, windowSeconds: 10 * 60 }), 5 * 60);
    });

    it("answers at least one second for a row about to leave the window", async () => {
      const { repository, user, organization } = await setup();

      const secondsUntilRoom = await container.resolve(TxService).transaction(async () => {
        await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [59.999] }, container.resolve(TxService).getPgTx());

        return await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 1, ...HOUR });
      });

      expect(secondsUntilRoom).toBe(1);
    });

    it("sees the rows written earlier in the surrounding transaction", async () => {
      const { repository, user, organization } = await setup();

      const secondsUntilRoom = await container.resolve(TxService).transaction(async () => {
        await seedTemplates({ authorId: user.id, organizationId: organization.id, minutesAgo: [0] }, container.resolve(TxService).getPgTx());

        return await repository.findSecondsUntilRoom("create", { userId: user.id }, { max: 1, ...HOUR });
      });

      expectAbout(secondsUntilRoom, 60 * 60);
    });
  });

  function expectAbout(seconds: number | undefined, expected: number) {
    expect(seconds).toBeGreaterThan(expected - 30);
    expect(seconds).toBeLessThanOrEqual(expected + 1);
  }

  function minutesAgoSql(minutes: number) {
    return sql`now() - make_interval(secs => ${minutes * 60})`;
  }

  async function seedTemplates(
    input: { authorId: string; organizationId: string; minutesAgo: number[] },
    db: Pick<ApiPgDatabase, "insert"> = container.resolve<ApiPgDatabase>(POSTGRES_DB)
  ) {
    return await db
      .insert(resolveTable("Templates"))
      .values(
        input.minutesAgo.map(minutes => ({
          authorId: input.authorId,
          organizationId: input.organizationId,
          title: faker.lorem.words(3),
          sdl: "version: '2.0'",
          cpu: 1000,
          ram: 1024,
          storage: 1024,
          createdAt: minutesAgoSql(minutes)
        }))
      )
      .returning();
  }

  async function seedVersions(templateId: string, versions: { version: number; createdById: string; minutesAgo: number }[]) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateVersions"))
      .values(versions.map(({ minutesAgo, ...version }) => ({ ...version, templateId, sdl: "version: '2.0'", createdAt: minutesAgoSql(minutesAgo) })));
  }

  async function seedAcceptances(acceptances: { templateId: string; userId: string; organizationId: string; minutesAgo: number }[]) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateTermsAcceptances"))
      .values(acceptances.map(({ minutesAgo, ...acceptance }) => ({ ...acceptance, termsVersion: "2026-11", acceptedAt: minutesAgoSql(minutesAgo) })));
  }

  async function setup() {
    const [user, organization] = await Promise.all([seedUser(), seedOrganization()]);

    return { repository: container.resolve(TemplateRateLimitRepository), user, organization };
  }
});
