import { faker } from "@faker-js/faker";
import { subDays, subHours } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import {
  findStoredTemplate,
  findStoredTemplateVersions,
  seedTemplate,
  seedTemplateDeployers,
  seedTemplateFavorite,
  seedTemplatePublisher,
  seedTemplateScore,
  seedTemplateVersion
} from "@test/seeders/db/template.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type TemplateInsert = ApiPgTables["Templates"]["$inferInsert"];
type TemplateVersionInsert = ApiPgTables["TemplateVersions"]["$inferInsert"];
type TemplateUsageEventInsert = ApiPgTables["TemplateUsageEvents"]["$inferInsert"];

const SDL = [
  "version: '2.0'",
  "services:",
  "  web:",
  "    image: nginx:1.27",
  "    env:",
  "      - GREETING=hello",
  "      - API_TOKEN=",
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
  "      count: 2"
].join("\n");

const ASKED_VALUES = [
  { key: "GREETING", label: "Greeting", type: "text" as const, default: "hello", required: false, bindings: [{ service: "web", env: "GREETING" }] },
  { key: "API_TOKEN", label: "API token", type: "secret" as const, required: true, bindings: [{ service: "web", env: "API_TOKEN" }] }
];

const RESOURCES = { cpu: 1, memoryBytes: 1_073_741_824, storageBytes: 2_147_483_648 };

const VISITOR_CACHE = "public, max-age=60, stale-while-revalidate=120";

const PRIVATE_FIELDS = ["organizationId", "projectId", "userId", "authorId", "sdl", "slug", "email", "publishingSuspendedAt", "publishingSuspendedReason"];

describe("Community templates", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 404 on every gallery and publisher route while template_marketplace is off", async () => {
    const { owner, handle, read, actAs } = await setup({ isMarketplaceOn: false });
    const asOwner = actAs(owner);

    const responses = await Promise.all([
      read("/v1/community-templates"),
      read(`/v1/template-publishers/${handle}`),
      asOwner("/v1/template-publishers/current"),
      asOwner("/v1/template-publishers/current", { method: "PATCH", body: { data: { bio: "Hello" } } })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
  });

  describe("GET /v1/community-templates", () => {
    it("lists a published template as a card to a visitor without a session, cacheable by anyone", async () => {
      const { team, handle, read } = await setup({ publisher: { isVerified: true } });
      const publishedAt = subDays(new Date(), 2);
      const { template } = await publish(team.id, { summary: "Serves a page", icon: "globe", categories: ["Web"], isFeatured: true, publishedAt });
      await seedTemplateVersion({ templateId: template.id, version: 2, sdl: SDL, resources: { ...RESOURCES, cpu: 64 }, status: "held", isCurrent: false });
      await seedUsage(template.id, [
        ...times(3, () => ({ action: "deploy" as const })),
        ...times(2, () => ({ action: "deploy" as const, organizationId: team.id })),
        ...times(4, () => ({ action: "deploy" as const, network: "sandbox" })),
        ...times(5, () => ({ action: "lease_created" as const, createdAt: subHours(new Date(), 25) })),
        ...times(4, () => ({ action: "still_running_24h" as const })),
        { action: "fork" as const }
      ]);
      const stored = await findStoredTemplate(template.id);

      const response = await read("/v1/community-templates");
      const body = (await response.json()) as GalleryBody;

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(VISITOR_CACHE);
      expect(body.data.templates.find(card => card.id === template.id)).toEqual({
        id: template.id,
        title: template.title,
        summary: "Serves a page",
        icon: "globe",
        categories: ["Web"],
        isOfficial: false,
        importedRef: null,
        isFeatured: true,
        publisher: { name: team.name, handle, verified: true },
        resources: RESOURCES,
        versionCount: 1,
        publishedAt: publishedAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
        usage: { deploys: 3, stillUpAfter24h: 0.8, forks: 1 },
        scores: { popular: null, trending: null, isTrending: false }
      });
    });

    it("carries no private field of a template, its organization or its publisher", async () => {
      const { team, read } = await setup();
      await publish(team.id);

      const response = await read("/v1/community-templates");
      const text = await response.text();

      expect(PRIVATE_FIELDS.filter(field => text.includes(`"${field}"`))).toEqual([]);
      expect(text).not.toContain(team.id);
      expect(text).not.toContain(team.slug);
    });

    it.each<[string, Partial<TemplateInsert>]>([
      ["private", { visibility: "private", isPublic: false }],
      ["shared with its organization only", { visibility: "organization", isPublic: false }],
      ["public by link only", { isListed: false }],
      ["public since before the publish gate", { publishedAt: null }],
      ["hidden by staff", { moderationStatus: "hidden" }],
      ["removed", { moderationStatus: "removed" }]
    ])("leaves out a template that is %s", async (_state, state) => {
      const { team, read } = await setup();
      const [{ template: shown }, { template: left }] = await Promise.all([publish(team.id), publish(team.id, state)]);

      const body = (await (await read("/v1/community-templates")).json()) as GalleryBody;
      const ids = body.data.templates.map(card => card.id);

      expect(ids).toContain(shown.id);
      expect(ids).not.toContain(left.id);
    });

    it("leaves out the templates of a suspended publisher and one whose only version waits for review", async () => {
      const { team, read } = await setup({ publisher: { publishingSuspendedAt: new Date(), publishingSuspendedReason: "Miners" } });
      const { team: other } = await setup();
      const [{ template: suspended }, { template: held }] = await Promise.all([publish(team.id), publish(other.id, {}, { status: "held" })]);

      const body = (await (await read("/v1/community-templates")).json()) as GalleryBody;
      const ids = body.data.templates.map(card => card.id);

      expect(ids).not.toContain(suspended.id);
      expect(ids).not.toContain(held.id);
    });

    it("answers the usage of awesome-akash templates by id, mainnet only", async () => {
      const { read } = await setup();
      const templateRef = `akash-network-awesome-akash-${faker.string.alphanumeric(10)}`;
      await seedUsage(templateRef, [
        ...times(3, () => ({ source: "awesome_akash" as const, action: "deploy" as const })),
        { source: "awesome_akash" as const, action: "deploy" as const, network: "sandbox" },
        { source: "console" as const, action: "deploy" as const }
      ]);

      const body = (await (await read("/v1/community-templates")).json()) as GalleryBody;

      expect(body.data.officialUsage[templateRef]).toEqual({
        deploys: 3,
        stillUpAfter24h: null,
        forks: 0,
        scores: { popular: null, trending: null, isTrending: false }
      });
    });

    it("carries the popular and trending scores of Console and awesome-akash templates, and how many trending ones make a row", async () => {
      const { team, handle, read } = await setup();
      const { template } = await publish(team.id, { publishedAt: subDays(new Date(), 2) });
      const { template: unscored } = await publish(team.id, { publishedAt: subDays(new Date(), 1) });
      const templateRef = `akash-network-awesome-akash-${faker.string.alphanumeric(10)}`;
      await seedUsage(templateRef, [{ source: "awesome_akash" as const, action: "deploy" as const }]);
      await seedTemplateScore({ templateRef: template.id, popularScore: 18.25, trendingScore: 0.6, isTrending: true });
      await seedTemplateScore({ templateRef, source: "awesome_akash", popularScore: 240.5, trendingScore: -0.1, isTrending: false });

      const response = await read("/v1/community-templates");
      const body = (await response.json()) as GalleryBody;

      expect(response.status).toBe(200);
      expect(body.data.templates.find(card => card.id === template.id)?.scores).toEqual({ popular: 18.25, trending: 0.6, isTrending: true });
      expect(body.data.templates.find(card => card.id === unscored.id)?.scores).toEqual({ popular: null, trending: null, isTrending: false });
      expect(body.data.officialUsage[templateRef].scores).toEqual({ popular: 240.5, trending: -0.1, isTrending: false });
      expect(body.data.trendingRowMinTemplates).toBe(4);
      const publisherPage = (await (await read(`/v1/template-publishers/${handle}`)).json()) as PublisherBody;
      expect(publisherPage.data.templates.map(({ id, scores }) => ({ id, scores }))).toEqual([
        { id: unscored.id, scores: { popular: null, trending: null, isTrending: false } },
        { id: template.id, scores: { popular: 18.25, trending: 0.6, isTrending: true } }
      ]);
    });

    it("serves no score of a template that is hidden, removed, unlisted or no longer public, wherever it was scored", async () => {
      const { team, handle, read } = await setup();
      const unserved = await Promise.all([
        publish(team.id, { moderationStatus: "hidden" }),
        publish(team.id, { moderationStatus: "removed" }),
        publish(team.id, { isListed: false }),
        publish(team.id, { visibility: "private", isPublic: false }),
        publish(team.id, { visibility: "organization", isPublic: false })
      ]);
      await Promise.all(
        unserved.map(({ template }) => seedTemplateScore({ templateRef: template.id, popularScore: 98765.4321, trendingScore: 87654.321, isTrending: true }))
      );

      const [gallery, publisherPage] = await Promise.all([read("/v1/community-templates"), read(`/v1/template-publishers/${handle}`)]);
      const served = `${await gallery.text()}${await publisherPage.text()}`;

      expect([gallery.status, publisherPage.status]).toEqual([200, 200]);
      expect(served).not.toContain("98765.4321");
      expect(served).not.toContain("87654.321");
      expect(unserved.filter(({ template }) => served.includes(template.id))).toEqual([]);
    });

    it("answers a signed-in caller the same list, kept out of shared caches", async () => {
      const { team, owner, read, actAs } = await setup();
      const { template } = await publish(team.id);

      const [asVisitor, asMember] = await Promise.all([read("/v1/community-templates"), actAs(owner)("/v1/community-templates")]);

      expect(asMember.status).toBe(200);
      expect(asMember.headers.get("cache-control")).toBe("private, max-age=60, stale-while-revalidate=120");
      expect(((await asMember.json()) as GalleryBody).data.templates.find(card => card.id === template.id)).toEqual(
        ((await asVisitor.json()) as GalleryBody).data.templates.find(card => card.id === template.id)
      );
    });

    it("keeps answering from what it read for a short while", async () => {
      const { team, read } = await setup();
      await publish(team.id);

      const first = (await (await read("/v1/community-templates")).json()) as GalleryBody;
      const { template: publishedSince } = await publish(team.id);
      const second = (await (await read("/v1/community-templates")).json()) as GalleryBody;

      expect(second).toEqual(first);
      expect(second.data.templates.map(card => card.id)).not.toContain(publishedSince.id);
    });
  });

  describe("GET /v1/template-publishers/{handle}", () => {
    it("describes a publisher and the templates it lists to a visitor without a session, cacheable by anyone", async () => {
      const links = [{ url: "https://lambdagarage.dev/", label: "Site" }];
      const { team, handle, read } = await setup({
        organization: { createdAt: new Date("2025-03-10T00:00:00.000Z") },
        publisher: { bio: "We build GPU stacks.\nIssues on GitHub.", links, isVerified: true }
      });
      const [{ template: older }, { template: newer }] = await Promise.all([
        publish(team.id, { publishedAt: subDays(new Date(), 5) }),
        publish(team.id, { publishedAt: subDays(new Date(), 1) })
      ]);
      await publish(team.id, { moderationStatus: "hidden" });
      await publish(team.id, { visibility: "private", isPublic: false });
      await seedTemplateDeployers(older.id, 3);
      await seedTemplateDeployers(newer.id, 2);
      await seedTemplateDeployers(newer.id, 4, { organizationId: team.id });

      const response = await read(`/v1/template-publishers/${handle}`);
      const body = (await response.json()) as PublisherBody;

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(VISITOR_CACHE);
      expect(body.data).toEqual({
        name: team.name,
        handle,
        type: "team",
        bio: "We build GPU stacks.\nIssues on GitHub.",
        links,
        verified: true,
        memberSince: "2025-03-10T00:00:00.000Z",
        counts: { templates: 2, deploys: 5 },
        templates: [expect.objectContaining({ id: newer.id }), expect.objectContaining({ id: older.id })]
      });
      expect(body.data.templates[0]).toMatchObject({ publisher: { name: team.name, handle, verified: true }, usage: { deploys: 2 } });
    });

    it("carries no private field of the organization or its templates", async () => {
      const { team, handle, read } = await setup();
      await publish(team.id);

      const text = await (await read(`/v1/template-publishers/${handle}`)).text();

      expect(PRIVATE_FIELDS.filter(field => text.includes(`"${field}"`))).toEqual([]);
      expect(text).not.toContain(team.id);
      expect(text).not.toContain(team.slug);
    });

    it("describes a publisher that lists nothing with an empty page", async () => {
      const { handle, read } = await setup();

      const body = (await (await read(`/v1/template-publishers/${handle}`)).json()) as PublisherBody;

      expect(body.data).toMatchObject({ handle, bio: null, links: [], verified: false, counts: { templates: 0, deploys: 0 }, templates: [] });
    });

    it.each<[string, number, string]>([
      ["a handle nobody has", 404, `nobody-${faker.string.alphanumeric(10).toLowerCase()}`],
      ["a handle no publisher can have", 400, "Not_A_Handle"],
      ["a handle longer than any publisher's", 400, "a".repeat(65)]
    ])("answers %s with %s", async (_case, status, unknownHandle) => {
      const { read } = await setup();

      const response = await read(`/v1/template-publishers/${unknownHandle}`);

      expect(response.status).toBe(status);
    });

    it("answers 404 for a suspended publisher, to visitors and to its own members", async () => {
      const { team, owner, handle, read, actAs } = await setup({ publisher: { publishingSuspendedAt: new Date(), publishingSuspendedReason: "Miners" } });
      await publish(team.id);

      const responses = await Promise.all([read(`/v1/template-publishers/${handle}`), actAs(owner)(`/v1/template-publishers/${handle}`)]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404]);
      expect(await responses[0].text()).not.toContain("Miners");
    });

    it("never reads the word current as a publisher's handle", async () => {
      const { read } = await setup();

      const response = await read("/v1/template-publishers/current");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/template-publishers/current", () => {
    it.each<["owner" | "admin" | "member", boolean]>([
      ["owner", true],
      ["admin", true],
      ["member", false]
    ])("describes the active organization's publisher to its %s, who may change it: %s", async (role, canEdit) => {
      const { team, owner, handle, actAs, addMember } = await setup({ publisher: { bio: "Hello" } });
      const caller = role === "owner" ? owner : await addMember(role);

      const response = await actAs(caller)("/v1/template-publishers/current");

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        data: { name: team.name, handle, type: "team", bio: "Hello", links: [], verified: false, memberSince: team.createdAt.toISOString(), canEdit }
      });
    });

    it("answers 401 without a session and 404 for an organization that has not published yet", async () => {
      const { read, actAs } = await setup();
      const { user: newcomer, organization } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });

      const responses = await Promise.all([
        read("/v1/template-publishers/current"),
        actAs(newcomer, { organizationId: organization.id })("/v1/template-publishers/current")
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 404]);
    });
  });

  describe("PATCH /v1/template-publishers/current", () => {
    it("stores the bio and the links as the URL parser reads them, and shows them on the publisher page", async () => {
      const { team, owner, handle, read, actAs } = await setup();
      const bio = "We build GPU inference stacks.\n<b>Not markup</b> & issues on GitHub.";

      const response = await actAs(owner)("/v1/template-publishers/current", {
        method: "PATCH",
        body: {
          data: {
            bio: `  ${bio}  `,
            links: [
              { url: " HTTPS://LambdaGarage.dev " },
              { url: "https://github.com/lambda-garage", label: "  GitHub  " },
              { url: "https://x.com/a b", label: null }
            ]
          }
        }
      });
      const links = [
        { url: "https://lambdagarage.dev/", label: null },
        { url: "https://github.com/lambda-garage", label: "GitHub" },
        { url: "https://x.com/a%20b", label: null }
      ];
      const page = (await (await read(`/v1/template-publishers/${handle}`)).json()) as PublisherBody;

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: { name: team.name, handle, type: "team", bio, links, verified: false, memberSince: team.createdAt.toISOString(), canEdit: true }
      });
      expect(await findStoredPublisher(team.id)).toMatchObject({ bio, links, isVerified: false });
      expect(page.data).toMatchObject({ bio, links });
    });

    it("changes only what it is sent, and clears a bio sent blank", async () => {
      const links = [{ url: "https://lambdagarage.dev/", label: null }];
      const { team, owner, actAs, addMember } = await setup({ publisher: { bio: "Before", links } });
      const admin = await addMember("admin");

      const onlyBio = await actAs(admin)("/v1/template-publishers/current", { method: "PATCH", body: { data: { bio: "After" } } });
      const afterBio = await findStoredPublisher(team.id);
      const onlyLinks = await actAs(owner)("/v1/template-publishers/current", { method: "PATCH", body: { data: { links: [] } } });
      const afterLinks = await findStoredPublisher(team.id);
      const blankBio = await actAs(owner)("/v1/template-publishers/current", { method: "PATCH", body: { data: { bio: "   " } } });

      expect([onlyBio.status, onlyLinks.status, blankBio.status]).toEqual([200, 200, 200]);
      expect(afterBio).toMatchObject({ bio: "After", links });
      expect(afterLinks).toMatchObject({ bio: "After", links: [] });
      expect(await findStoredPublisher(team.id)).toMatchObject({ bio: null, links: [] });
    });

    it.each<[string, unknown]>([
      ["nothing to change", {}],
      ["a bio over 300 characters", { bio: "a".repeat(301) }],
      ["a bio with a control character", { bio: "Hello\u0007" }],
      ["a bio that flips the reading direction", { bio: "Hello \u202Edlrow" }],
      ["more than three links", { links: times(4, () => ({ url: "https://lambdagarage.dev/" })) }],
      ["a link that is not https", { links: [{ url: "http://lambdagarage.dev/" }] }],
      ["a script link", { links: [{ url: "javascript:alert(1)" }] }],
      ["a link to an address", { links: [{ url: "https://169.254.169.254/latest/meta-data" }] }],
      ["a link to a name inside a network", { links: [{ url: "https://metadata.google.internal/" }] }],
      ["a link with a port", { links: [{ url: "https://lambdagarage.dev:8443/" }] }],
      ["a link carrying a password", { links: [{ url: `https://${["sam", "word"].join(":")}@lambdagarage.dev/` }] }],
      ["a link over 200 characters", { links: [{ url: `https://lambdagarage.dev/${"a".repeat(200)}` }] }],
      ["a link that is not text", { links: [{ url: 42 }] }],
      ["a label on two lines", { links: [{ url: "https://lambdagarage.dev/", label: "Our\nsite" }] }],
      ["a blank label", { links: [{ url: "https://lambdagarage.dev/", label: "   " }] }],
      ["a label over 40 characters", { links: [{ url: "https://lambdagarage.dev/", label: "a".repeat(41) }] }]
    ])("refuses %s with 400 and stores nothing", async (_case, data) => {
      const { team, owner, actAs } = await setup({ publisher: { bio: "Before" } });

      const response = await actAs(owner)("/v1/template-publishers/current", { method: "PATCH", body: { data } });

      expect(response.status).toBe(400);
      expect(await findStoredPublisher(team.id)).toMatchObject({ bio: "Before", links: [] });
    });

    it("accepts a bio of exactly 300 characters, three links and a label of 40", async () => {
      const { team, owner, actAs } = await setup();
      const data = { bio: "a".repeat(300), links: times(3, () => ({ url: "https://lambdagarage.dev/", label: "b".repeat(40) })) };

      const response = await actAs(owner)("/v1/template-publishers/current", { method: "PATCH", body: { data } });

      expect(response.status).toBe(200);
      expect(await findStoredPublisher(team.id)).toMatchObject(data);
    });

    it("refuses a member who is neither owner nor admin with 403, a visitor with 401 and a publisher-less organization with 404", async () => {
      const { team, read, actAs, addMember } = await setup({ publisher: { bio: "Before" } });
      const member = await addMember("member");
      const { user: newcomer, organization } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const change = { method: "PATCH", body: { data: { bio: "After" } } };

      const responses = await Promise.all([
        actAs(member)("/v1/template-publishers/current", change),
        read("/v1/template-publishers/current", change),
        actAs(newcomer, { organizationId: organization.id })("/v1/template-publishers/current", change)
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 401, 404]);
      expect(await findStoredPublisher(team.id)).toMatchObject({ bio: "Before" });
    });

    it("lets an owner of another organization change nothing of this one", async () => {
      const { team, actAs } = await setup({ publisher: { bio: "Before" } });
      const { user: outsider } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });

      const response = await actAs(outsider)("/v1/template-publishers/current", { method: "PATCH", body: { data: { bio: "Defaced" } } });

      expect(response.status).not.toBe(200);
      expect(await findStoredPublisher(team.id)).toMatchObject({ bio: "Before" });
    });
  });

  describe("POST /v1/user-templates with copiedFromId", () => {
    it("copies what the source's readers deploy into a private template of the caller, and counts a fork", async () => {
      const { team } = await setup();
      const { template: source, version } = await publish(
        team.id,
        { description: "Legacy description" },
        { readme: "# Source readme", askedValues: ASKED_VALUES }
      );
      await seedTemplateVersion({ templateId: source.id, version: 2, sdl: SDL.replace("nginx:1.27", "miner:1.0"), status: "held", isCurrent: false });
      const { forker, forkerOrganization, fork } = await setupForker();

      const response = await fork({ title: "My copy", copiedFromId: source.id });
      const body = (await response.json()) as TemplateBody;
      const [storedVersion] = await findStoredTemplateVersions(body.data.id);

      expect(response.status).toBe(201);
      expect(body.data).toMatchObject({
        title: "My copy",
        visibility: "private",
        isListed: true,
        publishedAt: null,
        copiedFromId: source.id,
        copiedFrom: { id: source.id, title: source.title },
        currentVersion: { version: 1, status: "live", sdl: SDL, readme: "# Source readme", askedValues: ASKED_VALUES, resources: RESOURCES }
      });
      expect(await findStoredTemplate(body.data.id)).toMatchObject({
        organizationId: forkerOrganization.id,
        authorId: forker.id,
        copiedFromId: source.id,
        visibility: "private",
        isPublic: false
      });
      expect(storedVersion).toMatchObject({ sdl: SDL, createdById: forker.id });
      expect(await findStoredUsageEvents(source.id)).toEqual([
        expect.objectContaining({
          source: "console",
          action: "fork",
          userId: forker.id,
          organizationId: forkerOrganization.id,
          templateVersionId: version.id,
          network: "sandbox"
        })
      ]);
    });

    it("counts one fork a day however often the same person copies the template", async () => {
      const { team } = await setup();
      const { template: source } = await publish(team.id);
      const { fork } = await setupForker();
      const { fork: forkAsAnother } = await setupForker();

      const responses = [
        await fork({ title: "First", copiedFromId: source.id }),
        await fork({ title: "Second", sdl: SDL, copiedFromId: source.id }),
        await forkAsAnother({ title: "Third", copiedFromId: source.id })
      ];

      expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
      expect(await findStoredUsageEvents(source.id)).toHaveLength(2);
    });

    it("counts no fork for a copy made inside the publishing organization", async () => {
      const { team, owner, project, actAs } = await setup();
      const { template: source } = await publish(team.id);

      const response = await actAs(owner)("/v1/user-templates", {
        method: "POST",
        body: { data: { title: "Internal copy", copiedFromId: source.id, projectId: project.id } }
      });

      expect(response.status).toBe(201);
      expect(await findStoredUsageEvents(source.id)).toEqual([]);
    });

    it("keeps the content the copy was sent with, as a fork edited before it was saved", async () => {
      const { team } = await setup();
      const { template: source } = await publish(team.id, {}, { readme: "# Source readme" });
      const { fork } = await setupForker();
      const edited = SDL.replace("count: 2", "count: 3");

      const response = await fork({ title: "Edited copy", sdl: edited, readme: "Mine", copiedFromId: source.id });
      const body = (await response.json()) as TemplateBody;

      expect(response.status).toBe(201);
      expect(body.data.currentVersion).toMatchObject({ sdl: edited, readme: "Mine", askedValues: [] });
      expect(await findStoredUsageEvents(source.id)).toHaveLength(1);
    });

    it("refuses to copy a source whose content carries a secret's value, so no secret comes across", async () => {
      const { team } = await setup();
      const leaking = SDL.replace("API_TOKEN=", "API_TOKEN=hunter2");
      const { template: source } = await publish(team.id, {}, { sdl: leaking, askedValues: ASKED_VALUES });
      const { fork } = await setupForker();

      const response = await fork({ title: "Copy", copiedFromId: source.id });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_invalid" });
      expect(await findStoredUsageEvents(source.id)).toEqual([]);
    });

    it.each<[string, Partial<TemplateInsert>, number, string]>([
      ["private", { visibility: "private", isPublic: false }, 404, "template_copy_source_not_found"],
      ["hidden by staff", { moderationStatus: "hidden" }, 404, "template_copy_source_not_found"],
      ["removed after it was public", { moderationStatus: "removed", visibility: "private", isPublic: false }, 410, "template_removed"]
    ])("refuses to copy a template that is %s with %s, creating nothing", async (_state, state, status, code) => {
      const { team } = await setup();
      const { template: source } = await publish(team.id, state);
      const { forkerOrganization, fork } = await setupForker();

      const response = await fork({ title: "Copy", copiedFromId: source.id });

      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
      expect(await countTemplatesOf(forkerOrganization.id)).toBe(0);
      expect(await findStoredUsageEvents(source.id)).toEqual([]);
    });

    it.each<[string, (sourceId: string) => Record<string, unknown>]>([
      ["neither an SDL nor a source", () => ({ title: "Nothing" })],
      ["a readme but no SDL", copiedFromId => ({ title: "Copy", readme: "Mine", copiedFromId })],
      ["asked values but no SDL", copiedFromId => ({ title: "Copy", askedValues: [], copiedFromId })]
    ])("refuses a copy sent with %s with 400", async (_case, buildData) => {
      const { team } = await setup();
      const { template: source } = await publish(team.id);
      const { forkerOrganization, fork } = await setupForker();

      const response = await fork(buildData(source.id));

      expect(response.status).toBe(400);
      expect(await countTemplatesOf(forkerOrganization.id)).toBe(0);
      expect(await findStoredUsageEvents(source.id)).toEqual([]);
    });

    it("holds a copy to the limits of creating templates, counting no fork once they are reached", async () => {
      const { team } = await setup();
      const { template: source } = await publish(team.id);
      const { forker, forkerOrganization, fork } = await setupForker();
      await Promise.all(times(20, () => seedTemplate({ organizationId: forkerOrganization.id, authorId: forker.id })));

      const response = await fork({ title: "One too many", copiedFromId: source.id });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toEqual(expect.stringMatching(/^\d+$/));
      expect(await response.json()).toMatchObject({ code: "template_rate_limited", data: { action: "create" } });
      expect(await findStoredUsageEvents(source.id)).toEqual([]);
    });
  });

  describe("GET /v1/user-templates/{id}", () => {
    it("shows a visitor without a session the trust signals of a public template", async () => {
      const { team, handle, read } = await setup({
        organization: { createdAt: new Date("2025-03-10T00:00:00.000Z") },
        publisher: { isVerified: true }
      });
      const { template } = await publish(team.id);
      await publish(team.id);
      await seedTemplateDeployers(template.id, 3);
      await seedTemplateDeployers(template.id, 2, { organizationId: team.id });
      await seedUsage(template.id, [{ action: "fork" }, { action: "fork" }]);
      await Promise.all(times(4, () => seedTemplateFavorite(template.id)));

      const responses = await Promise.all([
        read(`/v1/user-templates/${template.id}`),
        read(`/v1/user-templates/${template.id}/versions`),
        read(`/v1/user-templates/${template.id}/versions/1`)
      ]);
      const body = (await responses[0].json()) as TemplateBody;

      expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
      expect(body.data.publisher).toEqual({
        name: team.name,
        slug: team.slug,
        type: "team",
        handle,
        verified: true,
        memberSince: "2025-03-10T00:00:00.000Z",
        counts: { templates: 2, deploys: 3 }
      });
      expect(body.data.usage).toMatchObject({ deploys: 3, forks: 2, favorites: 4 });
      expect(body.data).toMatchObject({ copiedFromId: null, copiedFrom: null, canEdit: false, isFavorite: false, projectId: null });
    });

    it("names the template a fork was copied from only while the caller may read it, never leaking its title afterwards", async () => {
      const { team } = await setup();
      const { template: source } = await publish(team.id, { title: `Secret plans ${faker.string.alphanumeric(8)}` });
      const { forkerOrganization, read: readAsForker } = await setupForker();
      const fork = await seedTemplate({ organizationId: forkerOrganization.id, copiedFromId: source.id });
      await seedTemplateVersion({ templateId: fork.id, sdl: SDL });

      const whilePublic = (await (await readAsForker(`/v1/user-templates/${fork.id}`)).json()) as TemplateBody;
      await updateTemplate(source.id, { visibility: "private", isPublic: false });
      const oncePrivate = await readAsForker(`/v1/user-templates/${fork.id}`);
      const oncePrivateText = await oncePrivate.clone().text();
      await updateTemplate(source.id, { moderationStatus: "removed" });
      const onceRemoved = await readAsForker(`/v1/user-templates/${fork.id}`);

      expect(whilePublic.data).toMatchObject({ copiedFromId: source.id, copiedFrom: { id: source.id, title: source.title } });
      expect(oncePrivate.status).toBe(200);
      expect(((await oncePrivate.json()) as TemplateBody).data).toMatchObject({ copiedFromId: null, copiedFrom: null });
      expect(oncePrivateText).not.toContain(source.title);
      expect(onceRemoved.status).toBe(200);
      expect(((await onceRemoved.json()) as TemplateBody).data).toMatchObject({ copiedFromId: null, copiedFrom: null });
    });

    it.each<[string, Partial<TemplateInsert>, number]>([
      ["private", { visibility: "private", isPublic: false }, 404],
      ["hidden by staff", { moderationStatus: "hidden" }, 404],
      ["removed after it was public", { moderationStatus: "removed", visibility: "private", isPublic: false }, 410]
    ])("answers a visitor without a session %s for a template that is %s", async (_state, state, status) => {
      const { team, read } = await setup();
      const { template } = await publish(team.id, state);

      const responses = await Promise.all([
        read(`/v1/user-templates/${template.id}`),
        read(`/v1/user-templates/${template.id}/versions`),
        read(`/v1/user-templates/${template.id}/versions/1`)
      ]);

      expect(responses.map(response => response.status)).toEqual([status, status, status]);
    });

    it("describes the publisher of a template whose organization has not published yet as no publisher at all", async () => {
      const { user, organization, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const { actAs } = await setup();
      const template = await seedTemplate({ organizationId: organization.id, projectId: project.id, authorId: user.id, userId: user.userId });
      await seedTemplateVersion({ templateId: template.id, sdl: SDL });

      const response = await actAs(user, { organizationId: organization.id })(`/v1/user-templates/${template.id}`);

      expect(response.status).toBe(200);
      expect(((await response.json()) as TemplateBody).data.publisher).toMatchObject({
        handle: null,
        verified: false,
        memberSince: null,
        counts: { templates: 0, deploys: 0 }
      });
    });
  });

  type GalleryBody = {
    data: {
      templates: ({ id: string } & Record<string, unknown>)[];
      officialUsage: Record<string, Record<string, unknown>>;
      trendingRowMinTemplates: number;
    };
  };

  type PublisherBody = { data: { templates: ({ id: string } & Record<string, unknown>)[] } & Record<string, unknown> };

  type TemplateBody = {
    data: { id: string; publisher: Record<string, unknown>; usage: Record<string, unknown>; currentVersion: Record<string, unknown> } & Record<string, unknown>;
  };

  function times<T>(count: number, build: () => T): T[] {
    return Array.from({ length: count }, build);
  }

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  async function publish(organizationId: string, template: Partial<TemplateInsert> = {}, version: Partial<TemplateVersionInsert> = {}) {
    const seeded = await seedTemplate({
      organizationId,
      visibility: "public",
      isPublic: true,
      isListed: true,
      publishedAt: new Date(),
      sdl: SDL,
      ...template
    });
    const seededVersion = await seedTemplateVersion({ templateId: seeded.id, sdl: SDL, resources: RESOURCES, ...version });

    return { template: seeded, version: seededVersion };
  }

  async function seedUsage(templateRef: string, events: Partial<TemplateUsageEventInsert>[]) {
    await db()
      .insert(resolveTable("TemplateUsageEvents"))
      .values(events.map(event => ({ source: "console" as const, templateRef, action: "deploy" as const, network: "mainnet", ...event })));
  }

  async function findStoredUsageEvents(templateRef: string) {
    const events = resolveTable("TemplateUsageEvents");

    return await db().select().from(events).where(eq(events.templateRef, templateRef));
  }

  async function findStoredPublisher(organizationId: string) {
    const publishers = resolveTable("TemplatePublishers");
    const [publisher] = await db().select().from(publishers).where(eq(publishers.organizationId, organizationId));

    return publisher;
  }

  async function countTemplatesOf(organizationId: string) {
    const templates = resolveTable("Templates");

    return await db().$count(templates, eq(templates.organizationId, organizationId));
  }

  async function updateTemplate(id: string, change: Partial<TemplateInsert>) {
    const templates = resolveTable("Templates");
    await db().update(templates).set(change).where(eq(templates.id, id));
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  const tokens = new Map<string, string>();

  function request(path: string, headers: Record<string, string>, init: { method?: string; body?: unknown }) {
    return app.request(path, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  }

  function actingAs(user: UserOutput, organizationId: string) {
    const token = faker.string.alphanumeric(40);
    tokens.set(token, user.userId!);

    return (path: string, init: { method?: string; body?: unknown } = {}) =>
      request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
  }

  async function setupForker() {
    const { user: forker, organization: forkerOrganization, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const read = actingAs(forker, forkerOrganization.id);
    const fork = (data: Record<string, unknown>) => read("/v1/user-templates", { method: "POST", body: { data: { projectId: project.id, ...data } } });

    return { forker, forkerOrganization, read, fork };
  }

  async function setup({
    isMarketplaceOn = true,
    organization,
    publisher
  }: {
    isMarketplaceOn?: boolean;
    organization?: Parameters<typeof seedOrganizationWithOwner>[0];
    publisher?: Partial<ApiPgTables["TemplatePublishers"]["$inferInsert"]>;
  } = {}) {
    MemoryCacheEngine.clearAllCaches();
    const { user: owner, organization: team, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput(), ...organization });
    const { handle } = await seedTemplatePublisher({ organizationId: team.id, ...publisher });

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => isMarketplaceOn || flag !== FeatureFlags.TEMPLATE_MARKETPLACE);

    const read = (path: string, init: { method?: string; body?: unknown } = {}) => request(path, {}, init);
    const actAs = (user: UserOutput, { organizationId = team.id }: { organizationId?: string } = {}) => actingAs(user, organizationId);
    const addMember = async (role: "member" | "admin") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, project, owner, handle, read, actAs, addMember };
  }
});
