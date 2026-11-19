import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import {
  NotifyTemplatePublishers,
  notifyTemplatePublishersKeyFor
} from "@src/template-marketplace/services/notify-template-publishers/notify-template-publishers.job";
import {
  ResolveTemplateVersionImageDigests,
  resolveTemplateVersionImageDigestsKeyFor
} from "@src/template-marketplace/services/resolve-template-version-image-digests/resolve-template-version-image-digests.job";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { findStoredTemplate, findStoredTemplateVersions, seedTemplate, seedTemplateDeployers, seedTemplateVersion } from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const POPULAR_FROM = 25;
const OFFICIAL_REASON = {
  kind: "official_template" as const,
  message: "This is an Official template, so Akash staff review every new version before it goes live."
};
const DIGEST = `sha256:${"a".repeat(64)}`;

type VersionBody = { data: { id: string; version: number; status: string; holdReasons: unknown; checkResults: unknown } };
type VersionListBody = { data: { version: number; status: string; holdReasons: unknown; reviewedAt: string | null; reviewNote: string | null }[] };
type TemplateListBody = { data: { id: string; publishedAt: string | null; latestVersion: unknown; canEdit: boolean; currentVersion: unknown }[] };

describe("Marketplace template held versions", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/user-templates/{id}/versions on a public template", () => {
    it("holds every new version of an Official template, keeps the current one live and tells the publisher", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template, current } = await seedPublicTemplate({ isOfficial: true });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:1.26" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as VersionBody;
      expect(data).toMatchObject({ version: 2, status: "held", holdReasons: [OFFICIAL_REASON], reviewedAt: null, reviewNote: null });
      expect(data.checkResults).not.toBeNull();
      expect(await findStoredTemplate(template.id)).toMatchObject({ currentVersionId: current.id, sdl: buildSdl() });
      expect(
        await findJobRows(NotifyTemplatePublishers[JOB_NAME], { singletonKey: notifyTemplatePublishersKeyFor({ source: "version_held", versionId: data.id }) })
      ).toHaveLength(1);
      expect(await findDigestJobs(data.id)).toHaveLength(1);
    });

    it("holds a version that moves a popular template to another image repository, naming the service and both images", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template, current } = await seedPublicTemplate();
      await seedTemplateDeployers(template.id, POPULAR_FROM);

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "ghcr.io/acme/nginx:1.25" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      expect(((await response.json()) as VersionBody).data).toMatchObject({
        status: "held",
        holdReasons: [
          {
            kind: "image_repository_changed",
            message: 'Service "web" moves from nginx:1.25 to ghcr.io/acme/nginx:1.25, an image repository the current version does not run.',
            service: "web",
            image: "ghcr.io/acme/nginx:1.25",
            previousImage: "nginx:1.25"
          }
        ]
      });
      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(current.id);
    });

    it("holds a version that opens another port of a popular template to the internet", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate();
      await seedTemplateDeployers(template.id, POPULAR_FROM);

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ extraGlobalPort: 22 }), askedValues: [], baseVersion: 1 } }
      });

      expect(((await response.json()) as VersionBody).data).toMatchObject({
        status: "held",
        holdReasons: [{ kind: "global_port_added", service: "web", port: 22, protocol: "tcp" }]
      });
    });

    it("lets a popular template move to another tag of the same image, spelled with its registry, without waiting", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate();
      await seedTemplateDeployers(template.id, POPULAR_FROM);

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "docker.io/library/nginx:1.26" }), askedValues: [], baseVersion: 1 } }
      });

      const { data } = (await response.json()) as VersionBody;
      expect(data).toMatchObject({ version: 2, status: "live", holdReasons: null });
      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(data.id);
      expect(await findDigestJobs(data.id)).toHaveLength(1);
    });

    it("lets a risky change go live on a template one deployer short of popular, counting nobody from the publishing organization", async () => {
      const { owner, team, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate();
      await seedTemplateDeployers(template.id, POPULAR_FROM - 1);
      await seedTemplateDeployers(template.id, 3, { organizationId: team.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "ghcr.io/acme/nginx:1.25" }), askedValues: [], baseVersion: 1 } }
      });

      expect(((await response.json()) as VersionBody).data).toMatchObject({ status: "live", holdReasons: null });
    });

    it("stores a version that fails its checks as failed, never as held, even on an Official template", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate({ isOfficial: true });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:latest" }), askedValues: [], baseVersion: 1 } }
      });

      const { data } = (await response.json()) as VersionBody;
      expect(data).toMatchObject({ status: "failed_checks", holdReasons: null });
      expect(
        await findJobRows(NotifyTemplatePublishers[JOB_NAME], { singletonKey: notifyTemplatePublishersKeyFor({ source: "version_held", versionId: data.id }) })
      ).toEqual([]);
    });

    it("holds no version of an Official template that is not public", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate({ isOfficial: true, visibility: "organization" });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "ghcr.io/acme/nginx:1.25" }), askedValues: [], baseVersion: 1 } }
      });

      expect(((await response.json()) as VersionBody).data).toMatchObject({ status: "live", holdReasons: null });
    });

    it("takes a version saved while another waits, edited from the held one or from the current one, and holds or publishes it on its own merits", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template, current } = await seedPublicTemplate();
      await seedTemplateDeployers(template.id, POPULAR_FROM);
      const asOwner = actAs(owner);
      const save = (sdl: string, baseVersion: number) =>
        asOwner(`/v1/user-templates/${template.id}/versions`, { method: "POST", body: { data: { sdl, askedValues: [], baseVersion } } });

      const held = await save(buildSdl({ image: "ghcr.io/acme/nginx:1.25" }), 1);
      const alsoHeld = await save(buildSdl({ image: "ghcr.io/acme/nginx:1.26" }), 2);
      const stillCurrent = (await findStoredTemplate(template.id)).currentVersionId;
      const live = await save(buildSdl({ image: "nginx:1.27" }), 1);

      expect([held.status, alsoHeld.status, live.status]).toEqual([201, 201, 201]);
      const liveVersion = ((await live.json()) as VersionBody).data;
      expect(stillCurrent).toBe(current.id);
      expect((await findStoredTemplateVersions(template.id)).map(({ version, status }) => [version, status])).toEqual([
        [1, "live"],
        [2, "held"],
        [3, "held"],
        [4, "live"]
      ]);
      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(liveVersion.id);
    });
  });

  describe("reading held and reviewed versions", () => {
    it("shows an editor the held and rejected versions with why they waited and what staff decided", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate();
      const reviewedAt = new Date("2026-11-10T09:00:00.000Z");
      await seedTemplateVersion({
        templateId: template.id,
        version: 2,
        status: "rejected",
        holdReasons: [OFFICIAL_REASON],
        reviewedAt,
        reviewNote: "Runs a miner.",
        isCurrent: false
      });
      await seedTemplateVersion({ templateId: template.id, version: 3, status: "held", holdReasons: [OFFICIAL_REASON], isCurrent: false });
      const asOwner = actAs(owner);

      const [list, held, rejected, described] = await Promise.all([
        asOwner(`/v1/user-templates/${template.id}/versions`),
        asOwner(`/v1/user-templates/${template.id}/versions/3`),
        asOwner(`/v1/user-templates/${template.id}/versions/2`),
        asOwner(`/v1/user-templates/${template.id}`)
      ]);

      expect(
        ((await list.json()) as VersionListBody).data.map(({ version, status, holdReasons, reviewedAt, reviewNote }) => ({
          version,
          status,
          holdReasons,
          reviewedAt,
          reviewNote
        }))
      ).toEqual([
        { version: 3, status: "held", holdReasons: [OFFICIAL_REASON], reviewedAt: null, reviewNote: null },
        { version: 2, status: "rejected", holdReasons: [OFFICIAL_REASON], reviewedAt: "2026-11-10T09:00:00.000Z", reviewNote: "Runs a miner." },
        { version: 1, status: "live", holdReasons: null, reviewedAt: null, reviewNote: null }
      ]);
      expect(await held.json()).toMatchObject({ data: { version: 3, status: "held", holdReasons: [OFFICIAL_REASON] } });
      expect(await rejected.json()).toMatchObject({
        data: { version: 2, status: "rejected", reviewedAt: "2026-11-10T09:00:00.000Z", reviewNote: "Runs a miner." }
      });
      expect(await described.json()).toMatchObject({ data: { currentVersion: { version: 1, status: "live" } } });
    });

    it("shows a visitor and a signed-in stranger the current version only, and nothing staff wrote about it", async () => {
      const { read, actAs, seedPublicTemplate } = await setup();
      const { user: stranger, organization: strangersTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const { template, current } = await seedPublicTemplate({
        currentVersion: { holdReasons: [OFFICIAL_REASON], reviewedAt: new Date(), reviewNote: "Approved.", imageDigests: { "nginx:1.25": DIGEST } }
      });
      await seedTemplateVersion({ templateId: template.id, version: 2, status: "rejected", reviewNote: "Runs a miner.", isCurrent: false });
      await seedTemplateVersion({ templateId: template.id, version: 3, status: "held", holdReasons: [OFFICIAL_REASON], isCurrent: false });
      const readers = [read, actAs(stranger, { organizationId: strangersTeam.id })];

      for (const reader of readers) {
        const [list, currentVersion, held, rejected, described] = await Promise.all([
          reader(`/v1/user-templates/${template.id}/versions`),
          reader(`/v1/user-templates/${template.id}/versions/1`),
          reader(`/v1/user-templates/${template.id}/versions/3`),
          reader(`/v1/user-templates/${template.id}/versions/2`),
          reader(`/v1/user-templates/${template.id}`)
        ]);

        expect([list.status, currentVersion.status, held.status, rejected.status, described.status]).toEqual([200, 200, 404, 404, 200]);
        expect(((await list.json()) as VersionListBody).data).toMatchObject([
          { version: 1, status: "live", holdReasons: null, reviewedAt: null, reviewNote: null }
        ]);
        expect(await currentVersion.json()).toMatchObject({
          data: { id: current.id, holdReasons: null, reviewedAt: null, reviewNote: null, checkResults: null, imageDigests: { "nginx:1.25": DIGEST } }
        });
        expect(await described.json()).toMatchObject({
          data: { currentVersion: { id: current.id, holdReasons: null, reviewedAt: null, reviewNote: null, imageDigests: { "nginx:1.25": DIGEST } } }
        });
      }
    });
  });

  describe("GET /v1/user-templates", () => {
    it("tells members who may edit a template when it first went public and what became of its newest version, in the list", async () => {
      const { owner, actAs, addMember, seedPublicTemplate } = await setup();
      const viewer = await addMember("member", "viewer");
      const publishedAt = new Date("2026-11-01T10:00:00.000Z");
      const { template: withHeld } = await seedPublicTemplate({ publishedAt });
      await seedTemplateVersion({ templateId: withHeld.id, version: 2, status: "held", holdReasons: [OFFICIAL_REASON], isCurrent: false });
      const { template: withFailed } = await seedPublicTemplate({ visibility: "organization", publishedAt: null });
      await seedTemplateVersion({ templateId: withFailed.id, version: 2, status: "failed_checks", isCurrent: false });
      const { template: settled } = await seedPublicTemplate({ visibility: "organization", publishedAt: null });

      const forOwner = ((await (await actAs(owner)("/v1/user-templates")).json()) as TemplateListBody).data;
      const forViewer = ((await (await actAs(viewer)("/v1/user-templates")).json()) as TemplateListBody).data;

      const listed = (items: TemplateListBody["data"]) =>
        Object.fromEntries(items.map(({ id, publishedAt, latestVersion, canEdit }) => [id, { publishedAt, latestVersion, canEdit }]));
      expect(listed(forOwner)).toEqual({
        [withHeld.id]: { publishedAt: "2026-11-01T10:00:00.000Z", latestVersion: { version: 2, status: "held" }, canEdit: true },
        [withFailed.id]: { publishedAt: null, latestVersion: { version: 2, status: "failed_checks" }, canEdit: true },
        [settled.id]: { publishedAt: null, latestVersion: { version: 1, status: "live" }, canEdit: true }
      });
      expect(listed(forViewer)).toEqual({
        [withHeld.id]: { publishedAt: "2026-11-01T10:00:00.000Z", latestVersion: null, canEdit: false },
        [withFailed.id]: { publishedAt: null, latestVersion: null, canEdit: false },
        [settled.id]: { publishedAt: null, latestVersion: null, canEdit: false }
      });
      expect(forOwner.find(({ id }) => id === withHeld.id)?.currentVersion).toMatchObject({ version: 1, status: "live" });
    });
  });

  describe("POST /v1/user/saveTemplate", () => {
    it("refuses a change that would wait for staff while template_marketplace is on, and saves nothing", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate({ isOfficial: true });

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(template, buildSdl({ image: "nginx:1.26" })) });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "template_version_review_required", data: { holdReasons: [OFFICIAL_REASON] } });
      expect(await findStoredTemplateVersions(template.id)).toHaveLength(1);
      expect(await findStoredTemplate(template.id)).toMatchObject({ sdl: buildSdl() });
    });

    it("saves a change that needs no review while template_marketplace is on, and queues its digests", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup();
      const { template } = await seedPublicTemplate();

      const response = await actAs(owner)("/v1/user/saveTemplate", {
        method: "POST",
        body: legacySaveOf(template, buildSdl({ image: "ghcr.io/acme/nginx:1.25" }))
      });

      expect(response.status).toBe(200);
      const versions = await findStoredTemplateVersions(template.id);
      expect(versions.map(({ version, status }) => [version, status])).toEqual([
        [1, "live"],
        [2, "live"]
      ]);
      expect(await findDigestJobs(versions[1].id)).toHaveLength(1);
    });

    it("saves as it always did while template_marketplace is off: no review, no hold and no digest lookup", async () => {
      const { owner, actAs, seedPublicTemplate } = await setup({ isMarketplaceOn: false });
      const { template } = await seedPublicTemplate({ isOfficial: true });
      await seedTemplateDeployers(template.id, POPULAR_FROM);

      const response = await actAs(owner)("/v1/user/saveTemplate", {
        method: "POST",
        body: legacySaveOf(template, buildSdl({ image: "ghcr.io/acme/nginx:1.25" }))
      });

      expect(response.status).toBe(200);
      const versions = await findStoredTemplateVersions(template.id);
      expect(versions.map(({ version, status, holdReasons }) => [version, status, holdReasons])).toEqual([
        [1, "live", null],
        [2, "live", null]
      ]);
      expect((await findStoredTemplate(template.id)).currentVersionId).toBe(versions[1].id);
      expect(await findDigestJobs(versions[1].id)).toEqual([]);
    });
  });

  it("answers 404 on the version routes when template_marketplace is off", async () => {
    const { owner, actAs, seedPublicTemplate } = await setup({ isMarketplaceOn: false });
    const { template } = await seedPublicTemplate({ isOfficial: true });
    const asOwner = actAs(owner);

    const responses = await Promise.all([
      asOwner(`/v1/user-templates/${template.id}/versions`, { method: "POST", body: { data: { sdl: buildSdl(), askedValues: [], baseVersion: 1 } } }),
      asOwner(`/v1/user-templates/${template.id}/versions`),
      asOwner(`/v1/user-templates/${template.id}/versions/1`),
      asOwner("/v1/user-templates")
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    expect(await findStoredTemplateVersions(template.id)).toHaveLength(1);
  });

  async function findDigestJobs(versionId: string) {
    return await findJobRows(ResolveTemplateVersionImageDigests[JOB_NAME], { singletonKey: resolveTemplateVersionImageDigestsKeyFor(versionId) });
  }

  function legacySaveOf(template: { id: string; title: string }, sdl: string) {
    return { id: template.id, title: template.title, sdl, cpu: 1000, ram: 1024, storage: 1024, isPublic: true };
  }

  function buildSdl({ image = "nginx:1.25", extraGlobalPort }: { image?: string; extraGlobalPort?: number } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      `    image: ${image}`,
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
      ...(extraGlobalPort ? [`      - port: ${extraGlobalPort}`, `        as: ${extraGlobalPort}`, "        to:", "          - global: true"] : []),
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      "          units: 0.5",
      "        memory:",
      "          size: 512Mi",
      "        storage:",
      "          size: 1Gi",
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      "      count: 1"
    ].join("\n");
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const {
      user: owner,
      organization: team,
      project
    } = await seedOrganizationWithOwner({ user: createSignedUpUserInput(), name: `Team ${faker.string.alpha(10)}` });
    const tokens = new Map<string, string>();

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => isMarketplaceOn || flag !== FeatureFlags.TEMPLATE_MARKETPLACE);

    const request = (path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) =>
      app.request(path, {
        method: init.method ?? "GET",
        headers: { "content-type": "application/json", ...headers },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);

    const actAs = (user: UserOutput, { organizationId = team.id }: { organizationId?: string } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
    };

    const addMember = async (role: "member" | "admin", projectRole: "member" | "viewer") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });

      return user;
    };

    const seedPublicTemplate = async ({
      currentVersion,
      ...overrides
    }: Parameters<typeof seedTemplate>[0] & { currentVersion?: Omit<Parameters<typeof seedTemplateVersion>[0], "templateId"> } = {}) => {
      const template = await seedTemplate({
        organizationId: team.id,
        projectId: project.id,
        userId: owner.userId,
        authorId: owner.id,
        title: `Web server ${faker.string.alpha(8)}`,
        sdl: buildSdl(),
        visibility: "public",
        publishedAt: new Date(),
        ...overrides
      });
      const current = await seedTemplateVersion({ templateId: template.id, sdl: buildSdl(), createdById: owner.id, ...currentVersion });

      return { template, current };
    };

    return { owner, team, project, read, actAs, addMember, seedPublicTemplate };
  }
});
