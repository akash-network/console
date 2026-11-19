import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import type { PublishCheckResults } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplateVersionHoldReason } from "@src/template-marketplace/lib/version-hold/version-hold-reasons";
import type { TemplateVersionStatus } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import { TemplateVersionRepository } from "./template-version.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const PASSED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "passed", issues: [] }
  ]
};
const FAILED_CHECKS: PublishCheckResults = {
  ranAt: "2026-11-18T10:00:00.000Z",
  checks: [
    { key: "sdl_valid", status: "passed", issues: [] },
    { key: "fixed_tags", status: "failed", issues: [{ message: "Pin the tag", service: "web", image: "nginx" }] }
  ]
};

describe(TemplateVersionRepository.name, () => {
  const createdTemplateIds: string[] = [];

  afterEach(async () => {
    const templates = resolveTable("Templates");
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

    for (const id of createdTemplateIds) {
      await db.delete(templates).where(eq(templates.id, id));
    }
    createdTemplateIds.length = 0;
  });

  describe("appendVersion", () => {
    it("numbers versions from 1 and points the template at the newest", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const first = await repository.appendVersion({ templateId: template.id, sdl: "version: '2.0'" });
      const second = await repository.appendVersion({ templateId: template.id, sdl: "version: '2.1'" });

      expect([first.version, second.version]).toEqual([1, 2]);
      expect(await repository.findCurrent(template.id)).toEqual(second);
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: second.id });
    });

    it("stores what the version was given and defaults the rest", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const resources = { cpu: 2, memoryBytes: 1024, storageBytes: 2048 };
      const portValue: AskedValue = { type: "number", key: "PORT", label: "Port", required: true, bindings: [{ service: "web", env: "PORT" }] };

      const version = await repository.appendVersion({ templateId: template.id, sdl: "sdl", readme: "# readme", askedValues: [portValue], resources });
      const bare = await repository.appendVersion({ templateId: template.id, sdl: "other" });

      expect(version).toEqual({
        id: expect.any(String),
        templateId: template.id,
        version: 1,
        sdl: "sdl",
        readme: "# readme",
        askedValues: [portValue],
        resources,
        imageDigests: {},
        status: "live",
        checkResults: null,
        changes: ["first_version"],
        holdReasons: null,
        reviewedAt: null,
        reviewNote: null,
        createdById: null,
        createdBy: null,
        createdAt: expect.any(Date)
      });
      expect(bare).toMatchObject({ readme: null, askedValues: [], resources: null });
    });

    it("numbers concurrent appends without a gap or a duplicate", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const versions = await Promise.all(Array.from({ length: 5 }, (_, index) => repository.appendVersion({ templateId: template.id, sdl: `sdl-${index}` })));

      expect(versions.map(({ version }) => version).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      const current = await repository.findCurrent(template.id);
      expect(current?.version).toBe(5);
    });

    it("stores the changes from the current version under the lock", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });
      const second = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("caddy:1") });
      const third = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("caddy:1"), readme: "# New" });

      expect([first.changes, second.changes, third.changes]).toEqual([["first_version"], ["image_changed"], ["readme_changed"]]);
      expect((await repository.listByTemplate(template.id)).map(({ changes }) => changes)).toEqual([["readme_changed"], ["image_changed"], ["first_version"]]);
    });

    it("reads an asked value sent in another key order than jsonb stores it as unchanged", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const asked: AskedValue = { key: "PORT", label: "Port", required: true, bindings: [{ service: "web", env: "PORT" }], type: "number" };
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), askedValues: [asked] });

      const resaved = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), askedValues: [asked] });

      expect(resaved.changes).toEqual([]);
    });

    it("tells the readme change against the readme the current version shows", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });

      const carried = await repository.appendVersion({
        templateId: template.id,
        sdl: sdlWithImage("nginx:1"),
        readme: "Legacy",
        readmesShown: { current: "Legacy", next: "Legacy" }
      });
      const edited = await repository.appendVersion({
        templateId: template.id,
        sdl: sdlWithImage("nginx:1"),
        readme: "# New",
        readmesShown: { current: "Legacy", next: "# New" }
      });

      expect([carried.changes, edited.changes]).toEqual([[], ["readme_changed"]]);
    });

    it("compares each concurrent append with the version it numbers after", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("app:0") });

      const versions = await Promise.all(
        Array.from({ length: 4 }, (_, index) => repository.appendVersion({ templateId: template.id, sdl: sdlWithImage(`app:${index + 1}`) }))
      );

      expect(versions.map(({ changes }) => changes)).toEqual(Array.from({ length: 4 }, () => ["image_tag_changed"]));
    });

    it("accepts an append whose expected current version is the current one", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });

      const second = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:2"), expectedCurrentVersionId: first.id });

      expect(second.version).toBe(2);
    });

    it("refuses an append whose expected current version is stale and records nothing", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:2") });

      const refused = repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:3"), expectedCurrentVersionId: first.id });

      await expect(refused).rejects.toMatchObject({ status: 409, message: "The template has a newer version", errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toHaveLength(2);
      expect((await repository.findCurrent(template.id))?.version).toBe(2);
    });

    it("lets exactly one of two appends from the same expected version through", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1") });

      const results = await Promise.allSettled(
        ["nginx:2", "nginx:3"].map(image => repository.appendVersion({ templateId: template.id, sdl: sdlWithImage(image), expectedCurrentVersionId: first.id }))
      );

      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toMatchObject({ status: 409, errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toHaveLength(2);
    });

    it("refuses an append expecting a current version on a template that has none", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const refused = repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1"), expectedCurrentVersionId: faker.string.uuid() });

      await expect(refused).rejects.toMatchObject({ status: 409, errorCode: "template_version_conflict" });
      expect(await repository.listByTemplate(template.id)).toEqual([]);
    });

    it("names the creator by username", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const creator = await seedUser({ username: faker.internet.userName() });

      const appended = await repository.appendVersion({ templateId: template.id, sdl: "a", createdById: creator.id });

      expect(appended.createdBy).toEqual({ username: creator.username });
      expect((await repository.findCurrent(template.id))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.findById(appended.id))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.findByTemplateAndVersion(template.id, 1))?.createdBy).toEqual({ username: creator.username });
      expect((await repository.listByTemplate(template.id))[0].createdBy).toEqual({ username: creator.username });
    });

    it("names no creator for a creator without a username", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const creator = await seedUser({ username: null });

      const appended = await repository.appendVersion({ templateId: template.id, sdl: "a", createdById: creator.id });

      expect(appended.createdBy).toBeNull();
      expect((await repository.findCurrent(template.id))?.createdBy).toBeNull();
    });

    it("numbers each template's versions on their own", async () => {
      const { repository } = setup();
      const [first, second] = await Promise.all([seedTemplate(), seedTemplate()]);

      await repository.appendVersion({ templateId: first.id, sdl: "a" });
      const version = await repository.appendVersion({ templateId: second.id, sdl: "b" });

      expect(version.version).toBe(1);
    });
  });

  describe("when a version comes with publish check results", () => {
    it("stores a version that passed as the live current version with what the checks found", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const version = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.27"), checkResults: PASSED_CHECKS });

      expect(version).toMatchObject({ version: 1, status: "live", checkResults: PASSED_CHECKS });
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: version.id });
    });

    it("stores a version that failed with its results, numbered after the current one, without making it current", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const current = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.27"), checkResults: PASSED_CHECKS });

      const failed = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:latest"), checkResults: FAILED_CHECKS });

      expect(failed).toMatchObject({ version: 2, status: "failed_checks", checkResults: FAILED_CHECKS, changes: ["image_tag_changed"] });
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: current.id });
      expect(await repository.findCurrent(template.id)).toEqual(current);
      expect(await repository.findById(failed.id)).toEqual(failed);
      expect(await repository.findByTemplateAndVersion(template.id, 2)).toEqual(failed);
    });

    it("numbers the version saved after a failed one past it and tells its changes from the current version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const current = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.27"), checkResults: PASSED_CHECKS });
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("redis:latest"), checkResults: FAILED_CHECKS });

      const fixed = await repository.appendVersion({
        templateId: template.id,
        sdl: sdlWithImage("nginx:1.28"),
        checkResults: PASSED_CHECKS,
        expectedCurrentVersionId: current.id
      });

      expect(fixed).toMatchObject({ version: 3, status: "live", changes: ["image_tag_changed"] });
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: fixed.id });
    });

    it("leaves a template whose first version failed without a current version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const failed = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:latest"), checkResults: FAILED_CHECKS });

      expect(failed).toMatchObject({ version: 1, status: "failed_checks" });
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: null });
      expect(await repository.findCurrent(template.id)).toBeUndefined();
    });

    it("lists failed versions with their results next to live ones", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.27") });
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:latest"), checkResults: FAILED_CHECKS });

      const versions = await repository.listByTemplate(template.id);

      expect(versions.map(({ version, status, checkResults }) => ({ version, status, checkResults }))).toEqual([
        { version: 2, status: "failed_checks", checkResults: FAILED_CHECKS },
        { version: 1, status: "live", checkResults: null }
      ]);
    });
  });

  describe("recordCheckResults", () => {
    it("records what the publish gate found on that version alone and leaves its content and status as they were", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.27") });
      const second = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("nginx:1.28") });

      await repository.recordCheckResults(second.id, PASSED_CHECKS);

      expect(await repository.findById(second.id)).toEqual({ ...second, checkResults: PASSED_CHECKS });
      expect(await repository.findById(first.id)).toEqual(first);
    });
  });

  describe("immutability", () => {
    it("refuses to change a saved version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const saved = await repository.appendVersion({ templateId: template.id, sdl: "a" });

      await expect(repository.updateById()).rejects.toThrow("Template versions are immutable");
      await expect(repository.updateBy()).rejects.toThrow("Template versions are immutable");
      await expect(repository.updateManyById()).rejects.toThrow("Template versions are immutable");
      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(saved);
    });

    it("refuses to delete a saved version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const saved = await repository.appendVersion({ templateId: template.id, sdl: "a" });

      await expect(repository.deleteById()).rejects.toThrow("Template versions are immutable");
      await expect(repository.deleteBy()).rejects.toThrow("Template versions are immutable");
      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(saved);
    });

    it("refuses to create a version outside appendVersion", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      await expect(repository.create()).rejects.toThrow("Template versions are immutable");
      expect(await repository.listByTemplate(template.id)).toEqual([]);
    });
  });

  describe("accessibleBy", () => {
    it("returns an unfiltered copy that reads every version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: "version: '2.0'" });

      const copy = repository.accessibleBy(createMongoAbility([]), "read");

      expect(copy).not.toBe(repository);
      expect(copy).toBeInstanceOf(TemplateVersionRepository);
      expect(await copy.listByTemplate(template.id)).toHaveLength(1);
    });
  });

  describe("findByTemplateAndVersion", () => {
    it("returns the version asked for and nothing for a version that does not exist", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: "a" });
      await repository.appendVersion({ templateId: template.id, sdl: "b" });

      expect(await repository.findByTemplateAndVersion(template.id, 1)).toEqual(first);
      expect(await repository.findByTemplateAndVersion(template.id, 3)).toBeUndefined();
    });
  });

  describe("findCurrent", () => {
    it("returns nothing for a template without versions", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      expect(await repository.findCurrent(template.id)).toBeUndefined();
    });
  });

  describe("findById", () => {
    it("returns that version with its content, or nothing for an unknown id", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const appended = await repository.appendVersion({ templateId: template.id, sdl: "sdl", readme: "# readme" });

      expect(await repository.findById(appended.id)).toEqual(appended);
      expect(await repository.findById(faker.string.uuid())).toBeUndefined();
    });
  });

  describe("staff review columns", () => {
    it("reads the review note and time staff wrote wherever it reads a version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const appended = await repository.appendVersion({ templateId: template.id, sdl: "sdl" });
      const reviewedAt = new Date("2026-11-10T09:00:00.000Z");
      const versions = resolveTable("TemplateVersions");
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(versions)
        .set({ reviewedAt, reviewNote: "Approved after a look at the image." })
        .where(eq(versions.id, appended.id));

      const read = [
        await repository.findById(appended.id),
        await repository.findCurrent(template.id),
        await repository.findByTemplateAndVersion(template.id, 1),
        (await repository.listByTemplate(template.id))[0]
      ];

      expect(read.map(version => [version?.reviewedAt, version?.reviewNote])).toEqual(Array(4).fill([reviewedAt, "Approved after a look at the image."]));
    });
  });

  describe("when a version comes with reasons to hold it", () => {
    const HOLD_REASONS: TemplateVersionHoldReason[] = [
      { kind: "image_repository_changed", message: "Moves to another repository.", service: "web", image: "other/web:1", previousImage: "acme/web:1" },
      { kind: "global_port_added", message: "Opens port 22.", service: "web", port: 22, protocol: "tcp" }
    ];

    it("stores it as held with its reasons, numbered after the current version, without making it current", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const live = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("acme/web:1"), checkResults: PASSED_CHECKS });

      const held = await repository.appendVersion({
        templateId: template.id,
        sdl: sdlWithImage("other/web:1"),
        checkResults: PASSED_CHECKS,
        holdReasons: HOLD_REASONS
      });

      expect(held).toMatchObject({ version: 2, status: "held", holdReasons: HOLD_REASONS, checkResults: PASSED_CHECKS, changes: ["image_changed"] });
      expect((await findStoredTemplate(template.id))?.currentVersionId).toBe(live.id);
      expect(await repository.findById(held.id)).toMatchObject({ status: "held", holdReasons: HOLD_REASONS });
      expect((await repository.listByTemplate(template.id)).map(({ version, status, holdReasons }) => ({ version, status, holdReasons }))).toEqual([
        { version: 2, status: "held", holdReasons: HOLD_REASONS },
        { version: 1, status: "live", holdReasons: null }
      ]);
    });

    it("stores a version given no reason as live and current, with no reasons", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const live = await repository.appendVersion({ templateId: template.id, sdl: "sdl", checkResults: PASSED_CHECKS, holdReasons: [] });

      expect(live).toMatchObject({ status: "live", holdReasons: null });
      expect((await findStoredTemplate(template.id))?.currentVersionId).toBe(live.id);
    });

    it("stores a version that failed its checks as failed, never as held, and keeps no reasons for it", async () => {
      const { repository } = setup();
      const template = await seedTemplate();

      const failed = await repository.appendVersion({ templateId: template.id, sdl: "sdl", checkResults: FAILED_CHECKS, holdReasons: HOLD_REASONS });

      expect(failed).toMatchObject({ status: "failed_checks", holdReasons: null });
    });

    it("numbers a version saved while one is held past it, compares it with the current version and makes it current when nothing holds it", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("acme/web:1"), checkResults: PASSED_CHECKS });
      const held = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("other/web:1"), holdReasons: HOLD_REASONS });

      const next = await repository.appendVersion({ templateId: template.id, sdl: sdlWithImage("acme/web:2"), checkResults: PASSED_CHECKS });

      expect(next).toMatchObject({ version: 3, status: "live", changes: ["image_tag_changed"] });
      expect((await findStoredTemplate(template.id))?.currentVersionId).toBe(next.id);
      expect(await repository.findById(held.id)).toMatchObject({ status: "held" });
    });
  });

  describe("recordImageDigests", () => {
    it("adds the digests of that version alone and keeps the ones it already recorded", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const version = await repository.appendVersion({ templateId: template.id, sdl: "sdl" });
      const other = await repository.appendVersion({ templateId: template.id, sdl: "other" });

      await repository.recordImageDigests(version.id, { "nginx:1.27": "sha256:first" });
      await repository.recordImageDigests(version.id, { "nginx:1.27": "sha256:moved", "ghcr.io/acme/web:1": "sha256:web" });

      expect((await repository.findById(version.id))?.imageDigests).toEqual({ "nginx:1.27": "sha256:first", "ghcr.io/acme/web:1": "sha256:web" });
      expect((await repository.findById(other.id))?.imageDigests).toEqual({});
      expect(await repository.findById(version.id)).toMatchObject({ sdl: "sdl", status: "live", version: 1 });
    });
  });

  describe("makeCurrent", () => {
    it("points that template alone at the version", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const untouched = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: "a" });
      const second = await repository.appendVersion({ templateId: template.id, sdl: "b" });
      const ofUntouched = await repository.appendVersion({ templateId: untouched.id, sdl: "c" });

      await repository.makeCurrent(template.id, first.id);

      expect((await findStoredTemplate(template.id))?.currentVersionId).toBe(first.id);
      expect((await findStoredTemplate(untouched.id))?.currentVersionId).toBe(ofUntouched.id);
      expect((await repository.findCurrent(template.id))?.id).not.toBe(second.id);
    });
  });

  describe("hasNewerLiveOrHeld", () => {
    it.each([
      { newer: "live", expected: true },
      { newer: "held", expected: true },
      { newer: "failed_checks", expected: false },
      { newer: "rejected", expected: false }
    ] as const)("answers $expected when the version saved after it is $newer", async ({ newer, expected }) => {
      const { repository } = setup();
      const template = await seedTemplate();
      const other = await seedTemplate();
      await seedVersion(template.id, 1, "live");
      await seedVersion(template.id, 2, "held");
      await seedVersion(template.id, 3, newer);
      await seedVersion(other.id, 9, "live");

      expect(await repository.hasNewerLiveOrHeld(template.id, 2)).toBe(expected);
    });

    it("looks past the version itself and the ones before it", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      await seedVersion(template.id, 1, "live");
      await seedVersion(template.id, 2, "live");

      expect(await repository.hasNewerLiveOrHeld(template.id, 2)).toBe(false);
      expect(await repository.hasNewerLiveOrHeld(template.id, 1)).toBe(true);
    });
  });

  describe("findNewestOf", () => {
    it("answers the newest version of each template asked for, whatever became of it, in one read", async () => {
      const { repository } = setup();
      const [held, failed, live, unasked, versionless] = await Promise.all([seedTemplate(), seedTemplate(), seedTemplate(), seedTemplate(), seedTemplate()]);
      await seedVersion(held.id, 1, "live");
      await seedVersion(held.id, 2, "rejected");
      await seedVersion(held.id, 3, "held");
      await seedVersion(failed.id, 1, "live");
      await seedVersion(failed.id, 2, "failed_checks");
      await seedVersion(live.id, 10, "live");
      await seedVersion(live.id, 9, "held");
      await seedVersion(unasked.id, 1, "live");

      const newest = await repository.findNewestOf([held.id, failed.id, live.id, versionless.id]);

      expect(newest).toEqual(
        new Map([
          [held.id, { version: 3, status: "held" }],
          [failed.id, { version: 2, status: "failed_checks" }],
          [live.id, { version: 10, status: "live" }]
        ])
      );
    });

    it("answers nothing for no template", async () => {
      const { repository } = setup();

      expect(await repository.findNewestOf([])).toEqual(new Map());
    });
  });

  describe("listByTemplate", () => {
    it("lists versions newest first without their sdl", async () => {
      const { repository } = setup();
      const template = await seedTemplate();
      const first = await repository.appendVersion({ templateId: template.id, sdl: "a", readme: "r1" });
      const second = await repository.appendVersion({ templateId: template.id, sdl: "b", readme: "r2" });

      const versions = await repository.listByTemplate(template.id);

      expect(versions).toEqual([
        {
          id: second.id,
          templateId: template.id,
          version: 2,
          resources: null,
          status: "live",
          checkResults: null,
          changes: ["readme_changed"],
          holdReasons: null,
          reviewedAt: null,
          reviewNote: null,
          createdById: null,
          createdBy: null,
          createdAt: second.createdAt
        },
        {
          id: first.id,
          templateId: template.id,
          version: 1,
          resources: null,
          status: "live",
          checkResults: null,
          changes: ["first_version"],
          holdReasons: null,
          reviewedAt: null,
          reviewNote: null,
          createdById: null,
          createdBy: null,
          createdAt: first.createdAt
        }
      ]);
    });
  });

  async function seedTemplate() {
    const organization = await seedOrganization();
    const project = await seedProject({ organizationId: organization.id, isDefault: true });
    const [template] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        organizationId: organization.id,
        projectId: project.id,
        title: faker.lorem.words(3),
        sdl: faker.lorem.paragraph(),
        cpu: 1000,
        ram: 1000000,
        storage: 1000000
      })
      .returning();
    createdTemplateIds.push(template.id);
    return template;
  }

  async function seedVersion(templateId: string, version: number, status: TemplateVersionStatus) {
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).insert(resolveTable("TemplateVersions")).values({ templateId, version, status, sdl: "sdl" });
  }

  function sdlWithImage(image: string) {
    return JSON.stringify({ version: "2.0", services: { web: { image } } });
  }

  async function findStoredTemplate(id: string) {
    const templates = resolveTable("Templates");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).query.Templates.findFirst({ where: eq(templates.id, id) });
  }

  function setup() {
    return { repository: container.resolve(TemplateVersionRepository) };
  }
});
