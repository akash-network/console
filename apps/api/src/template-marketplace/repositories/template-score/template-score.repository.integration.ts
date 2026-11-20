import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { type ScoredTemplate, scoreTemplate } from "@src/template-marketplace/lib/template-scores/template-scores";
import { TemplateScoreRepository } from "./template-score.repository";

import { seedOrganization } from "@test/seeders/db/organization.seeder";
import { findStoredTemplateScores, SEEDED_SCORING_SETTINGS, seedTemplate, seedTemplateScore, seedTemplateUsageEvent } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const LOOKBACK_DAYS = 180;
const HOUR_MS = 60 * 60 * 1000;

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * HOUR_MS);
}

function stillRunning(templateRef: string, overrides: Partial<Parameters<typeof seedTemplateUsageEvent>[0]> = {}) {
  return seedTemplateUsageEvent({ templateRef, action: "still_running_24h", createdAt: hoursAgo(1), ...overrides });
}

function deployed(templateRef: string, overrides: Partial<Parameters<typeof seedTemplateUsageEvent>[0]> = {}) {
  return seedTemplateUsageEvent({ templateRef, action: "deploy", createdAt: hoursAgo(1), ...overrides });
}

function scoreOf(templateRef: string, overrides: Partial<ScoredTemplate> = {}): ScoredTemplate {
  return { source: "console", templateRef, ...scoreTemplate([{ ageDays: 0, paid: 2, trial: 0 }], 1, SEEDED_SCORING_SETTINGS), ...overrides };
}

describe(TemplateScoreRepository.name, () => {
  describe("findStillRunningUserDays", () => {
    it("counts a user once per template and day, however many deployments were still running", async () => {
      const { repository, template } = await setup();
      const [oftenUser, otherUser] = await Promise.all([seedUser(), seedUser()]);
      await stillRunning(template.id, { userId: oftenUser.id, createdAt: new Date("2026-11-18T01:00:00.000Z") });
      await stillRunning(template.id, { userId: oftenUser.id, createdAt: new Date("2026-11-18T09:00:00.000Z") });
      await stillRunning(template.id, { userId: oftenUser.id, createdAt: new Date("2026-11-18T23:00:00.000Z") });
      await stillRunning(template.id, { userId: otherUser.id, createdAt: new Date("2026-11-18T10:00:00.000Z") });

      expect(await findUserDays(repository)).toEqual([{ source: "console", templateRef: template.id, ageDays: 1, paid: 2, trial: 0 }]);
    });

    it("counts the same user again on another day and for another template", async () => {
      const { repository, template } = await setup();
      const otherTemplate = await seedTemplate({ visibility: "public" });
      const user = await seedUser();
      await stillRunning(template.id, { userId: user.id, createdAt: new Date("2026-11-17T23:30:00.000Z") });
      await stillRunning(template.id, { userId: user.id, createdAt: new Date("2026-11-18T00:30:00.000Z") });
      await stillRunning(template.id, { userId: user.id, createdAt: new Date("2026-11-14T08:00:00.000Z") });
      await stillRunning(otherTemplate.id, { userId: user.id, createdAt: new Date("2026-11-18T00:45:00.000Z") });

      expect(await findUserDays(repository)).toEqual(
        [
          { source: "console", templateRef: template.id, ageDays: 1, paid: 2, trial: 0 },
          { source: "console", templateRef: template.id, ageDays: 5, paid: 1, trial: 0 },
          { source: "console", templateRef: otherTemplate.id, ageDays: 1, paid: 1, trial: 0 }
        ].sort(byTemplateAndAge)
      );
    });

    it("leaves out the publishing organization's own usage and counts everyone else's", async () => {
      const { repository, template } = await setup();
      const otherOrganization = await seedOrganization();
      await stillRunning(template.id, { organizationId: template.organizationId });
      await stillRunning(template.id, { organizationId: template.organizationId, createdAt: hoursAgo(50) });
      await stillRunning(template.id, { organizationId: otherOrganization.id });
      await stillRunning(template.id, { organizationId: null });

      expect(await findUserDays(repository)).toEqual([{ source: "console", templateRef: template.id, ageDays: 0, paid: 2, trial: 0 }]);
    });

    it("counts a user's day as a trial one only when every deployment that day was on a trial", async () => {
      const { repository, template } = await setup();
      const [trialUser, convertedUser] = await Promise.all([seedUser(), seedUser()]);
      await stillRunning(template.id, { userId: trialUser.id, isTrial: true, createdAt: hoursAgo(2) });
      await stillRunning(template.id, { userId: trialUser.id, isTrial: true, createdAt: hoursAgo(3) });
      await stillRunning(template.id, { userId: convertedUser.id, isTrial: true, createdAt: hoursAgo(3) });
      await stillRunning(template.id, { userId: convertedUser.id, isTrial: false, createdAt: hoursAgo(2) });
      await stillRunning(template.id, { isTrial: false });

      expect(await findUserDays(repository)).toEqual([{ source: "console", templateRef: template.id, ageDays: 0, paid: 2, trial: 1 }]);
    });

    it("counts mainnet deployments that were still running, and no other action or network", async () => {
      const { repository, template } = await setup();
      await stillRunning(template.id);
      await stillRunning(template.id, { network: "sandbox" });
      await stillRunning(template.id, { network: "testnet" });
      await deployed(template.id);
      await seedTemplateUsageEvent({ templateRef: template.id, action: "lease_created", createdAt: hoursAgo(1) });
      await seedTemplateUsageEvent({ templateRef: template.id, action: "fork", createdAt: hoursAgo(1) });
      await seedTemplateUsageEvent({ templateRef: template.id, action: "favorite", createdAt: hoursAgo(1) });

      expect(await findUserDays(repository)).toEqual([{ source: "console", templateRef: template.id, ageDays: 0, paid: 1, trial: 0 }]);
    });

    it("ages a day in whole days back from the run and reads no further than the lookback", async () => {
      const { repository, template } = await setup();
      await stillRunning(template.id, { createdAt: hoursAgo(23.9) });
      await stillRunning(template.id, { createdAt: hoursAgo(24.1) });
      await stillRunning(template.id, { createdAt: hoursAgo(7 * 24 - 0.1) });
      await stillRunning(template.id, { createdAt: hoursAgo(10 * 24 - 0.1) });
      await stillRunning(template.id, { createdAt: hoursAgo(10 * 24 + 0.1) });
      await stillRunning(template.id, { createdAt: new Date(NOW.getTime() + HOUR_MS) });

      expect(await repository.findStillRunningUserDays({ now: NOW, lookbackDays: 10, maxTemplates: 100 })).toEqual([
        { source: "console", templateRef: template.id, ageDays: 0, paid: 1, trial: 0 },
        { source: "console", templateRef: template.id, ageDays: 1, paid: 1, trial: 0 },
        { source: "console", templateRef: template.id, ageDays: 6, paid: 1, trial: 0 },
        { source: "console", templateRef: template.id, ageDays: 9, paid: 1, trial: 0 }
      ]);
    });

    it("counts awesome-akash templates by the id deployments named, when it is shaped like a gallery id", async () => {
      const { repository } = await setup();
      const organization = await seedOrganization();
      await stillRunning("akash-network-awesome-akash-ollama", { source: "awesome_akash", organizationId: organization.id });
      await stillRunning("akash-network-awesome-akash-ollama", { source: "awesome_akash", isTrial: true });
      await stillRunning("../../etc/passwd", { source: "awesome_akash" });
      await stillRunning("<script>alert(1)</script>", { source: "awesome_akash" });

      expect(await findUserDays(repository)).toEqual([
        { source: "awesome_akash", templateRef: "akash-network-awesome-akash-ollama", ageDays: 0, paid: 1, trial: 1 }
      ]);
    });

    it("leaves out a deleted Console template and a deleted user", async () => {
      const { repository, template } = await setup();
      await stillRunning(faker.string.uuid());
      await stillRunning(template.id, { userId: null });
      await stillRunning(template.id);

      expect(await findUserDays(repository)).toEqual([{ source: "console", templateRef: template.id, ageDays: 0, paid: 1, trial: 0 }]);
    });

    it("counts a template that is private, hidden or removed like any other, since staff still read why it ranked", async () => {
      const { repository } = await setup();
      const templates = await Promise.all([
        seedTemplate({ visibility: "private" }),
        seedTemplate({ visibility: "public", moderationStatus: "hidden" }),
        seedTemplate({ visibility: "public", moderationStatus: "removed" })
      ]);
      await Promise.all(templates.map(({ id }) => stillRunning(id)));

      expect((await findUserDays(repository)).map(({ templateRef }) => templateRef).sort()).toEqual(templates.map(({ id }) => id).sort());
    });

    it("keeps the templates with the most user days when there are more than the cap", async () => {
      const { repository, template } = await setup();
      const [busier, busiest] = await Promise.all([seedTemplate({ visibility: "public" }), seedTemplate({ visibility: "public" })]);
      await stillRunning(template.id);
      await Promise.all([stillRunning(busier.id), stillRunning(busier.id, { createdAt: hoursAgo(30) })]);
      await Promise.all([stillRunning(busiest.id), stillRunning(busiest.id), stillRunning(busiest.id, { createdAt: hoursAgo(30) })]);

      const userDays = await repository.findStillRunningUserDays({ now: NOW, lookbackDays: LOOKBACK_DAYS, maxTemplates: 2 });

      expect(userDays).toEqual(
        [
          { source: "console", templateRef: busier.id, ageDays: 0, paid: 1, trial: 0 },
          { source: "console", templateRef: busier.id, ageDays: 1, paid: 1, trial: 0 },
          { source: "console", templateRef: busiest.id, ageDays: 0, paid: 2, trial: 0 },
          { source: "console", templateRef: busiest.id, ageDays: 1, paid: 1, trial: 0 }
        ].sort(byTemplateAndAge)
      );
    });
  });

  describe("countWeeklyDeployers", () => {
    it("counts the distinct mainnet deployers of the last week from outside the publishing organization", async () => {
      const { repository, template } = await setup();
      const repeatDeployer = await seedUser();
      await deployed(template.id, { userId: repeatDeployer.id });
      await deployed(template.id, { userId: repeatDeployer.id, createdAt: hoursAgo(48) });
      await deployed(template.id, { createdAt: hoursAgo(7 * 24 - 0.1) });
      await deployed(template.id, { createdAt: hoursAgo(7 * 24 + 0.1) });
      await deployed(template.id, { organizationId: template.organizationId });
      await deployed(template.id, { network: "sandbox" });
      await deployed(template.id, { userId: null });
      await stillRunning(template.id);
      await deployed("akash-network-awesome-akash-comfyui", { source: "awesome_akash" });

      expect(await repository.countWeeklyDeployers({ now: NOW, maxTemplates: 100 })).toEqual([
        { source: "console", templateRef: template.id, weeklyDeployers: 2 },
        { source: "awesome_akash", templateRef: "akash-network-awesome-akash-comfyui", weeklyDeployers: 1 }
      ]);
    });

    it("keeps the most deployed templates when there are more than the cap", async () => {
      const { repository, template } = await setup();
      const busier = await seedTemplate({ visibility: "public" });
      await deployed(template.id);
      await Promise.all([deployed(busier.id), deployed(busier.id)]);

      expect(await repository.countWeeklyDeployers({ now: NOW, maxTemplates: 1 })).toEqual([{ source: "console", templateRef: busier.id, weeklyDeployers: 2 }]);
    });
  });

  describe("replaceAll", () => {
    it("stores each score with its breakdown and when it was computed", async () => {
      const { repository } = await setup();
      const score = scoreOf("a-template");

      const replaced = await repository.replaceAll([score], NOW);

      expect(replaced).toEqual({ written: 1, deleted: 0 });
      expect(await findStoredTemplateScores()).toEqual([
        {
          source: "console",
          templateRef: "a-template",
          popularScore: 2,
          trendingScore: 0,
          weeklyDeployers: 1,
          isTrending: false,
          breakdown: score.breakdown,
          computedAt: NOW
        }
      ]);
    });

    it("rewrites the scores it is given and drops the ones it is not", async () => {
      const { repository } = await setup();
      await seedTemplateScore({ templateRef: "still-used", popularScore: 9, isTrending: true, computedAt: hoursAgo(1) });
      await seedTemplateScore({ templateRef: "no-longer-used", computedAt: hoursAgo(1) });
      await seedTemplateScore({ templateRef: "no-longer-used", source: "awesome_akash", computedAt: hoursAgo(1) });
      const rewritten = scoreOf("still-used", { popularScore: 3.5, trendingScore: 0.4, weeklyDeployers: 7, isTrending: false });

      const replaced = await repository.replaceAll([rewritten, scoreOf("new", { source: "awesome_akash" })], NOW);

      expect(replaced).toEqual({ written: 2, deleted: 2 });
      expect(await findStoredTemplateScores()).toMatchObject([
        {
          source: "console",
          templateRef: "still-used",
          popularScore: 3.5,
          trendingScore: 0.4,
          weeklyDeployers: 7,
          isTrending: false,
          breakdown: rewritten.breakdown,
          computedAt: NOW
        },
        { source: "awesome_akash", templateRef: "new", popularScore: 2, computedAt: NOW }
      ]);
    });

    it("stores the same rows when the same run is repeated", async () => {
      const { repository } = await setup();
      const scores = [scoreOf("first"), scoreOf("second", { popularScore: 4 })];

      await repository.replaceAll(scores, NOW);
      const stored = await findStoredTemplateScores();
      const replaced = await repository.replaceAll(scores, NOW);

      expect(replaced).toEqual({ written: 2, deleted: 0 });
      expect(await findStoredTemplateScores()).toEqual(stored);
    });

    it("neither overwrites nor drops what a later run already wrote", async () => {
      const { repository } = await setup();
      const later = new Date(NOW.getTime() + HOUR_MS);
      await seedTemplateScore({ templateRef: "rescored-later", popularScore: 9, computedAt: later });
      await seedTemplateScore({ templateRef: "scored-later-only", popularScore: 8, computedAt: later });

      const replaced = await repository.replaceAll([scoreOf("rescored-later", { popularScore: 1 })], NOW);

      expect(replaced).toEqual({ written: 1, deleted: 0 });
      expect(await findStoredTemplateScores()).toMatchObject([
        { templateRef: "rescored-later", popularScore: 9, computedAt: later },
        { templateRef: "scored-later-only", popularScore: 8, computedAt: later }
      ]);
    });

    it("writes more scores than one statement carries", async () => {
      const { repository } = await setup();
      const scores = Array.from({ length: 1001 }, (_, index) => scoreOf(`template-${String(index).padStart(4, "0")}`, { popularScore: index }));

      const replaced = await repository.replaceAll(scores, NOW);

      const stored = await findStoredTemplateScores();
      expect(replaced).toEqual({ written: 1001, deleted: 0 });
      expect(stored.map(({ templateRef, popularScore }) => ({ templateRef, popularScore }))).toEqual(
        scores.map(({ templateRef, popularScore }) => ({ templateRef, popularScore }))
      );
    });

    it("drops every score when no template was used", async () => {
      const { repository } = await setup();
      await seedTemplateScore({ templateRef: "forgotten", computedAt: hoursAgo(1) });

      expect(await repository.replaceAll([], NOW)).toEqual({ written: 0, deleted: 1 });
      expect(await findStoredTemplateScores()).toEqual([]);
    });
  });

  describe("findByRefs", () => {
    it("answers the served scores of the named templates of one source", async () => {
      const { repository } = await setup();
      await seedTemplateScore({ templateRef: "ollama", source: "awesome_akash", popularScore: 12.5, trendingScore: 0.6, isTrending: true });
      await seedTemplateScore({ templateRef: "comfyui", source: "awesome_akash", popularScore: 3, trendingScore: -0.2 });
      await seedTemplateScore({ templateRef: "not-asked", source: "awesome_akash", popularScore: 99 });
      await seedTemplateScore({ templateRef: "ollama", source: "console", popularScore: 77 });

      const scores = await repository.findByRefs("awesome_akash", ["ollama", "comfyui", "never-scored"]);

      expect(Object.fromEntries(scores)).toEqual({
        ollama: { popularScore: 12.5, trendingScore: 0.6, isTrending: true },
        comfyui: { popularScore: 3, trendingScore: -0.2, isTrending: false }
      });
    });

    it("answers nothing for no template", async () => {
      const { repository } = await setup();
      await seedTemplateScore({ templateRef: "ollama" });

      expect(await repository.findByRefs("console", [])).toEqual(new Map());
    });
  });

  function byTemplateAndAge(left: { templateRef: string; ageDays: number }, right: { templateRef: string; ageDays: number }) {
    return left.templateRef.localeCompare(right.templateRef) || left.ageDays - right.ageDays;
  }

  async function findUserDays(repository: TemplateScoreRepository) {
    return await repository.findStillRunningUserDays({ now: NOW, lookbackDays: LOOKBACK_DAYS, maxTemplates: 100 });
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    await db.delete(resolveTable("TemplateUsageEvents"));
    await db.delete(resolveTable("TemplateScores"));

    return { repository: container.resolve(TemplateScoreRepository), template: await seedTemplate({ visibility: "public" }) };
  }
});
