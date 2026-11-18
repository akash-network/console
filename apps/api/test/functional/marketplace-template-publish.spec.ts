import { faker } from "@faker-js/faker";
import { asc, eq, sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { PublishCheck } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import { COMMUNITY_TEMPLATE_TERMS_VERSION } from "@src/template-marketplace/lib/publish-requirements/publish-requirements";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const MEBIBYTE = 1024 ** 2;
const GIBIBYTE = 1024 ** 3;
const ACCEPT_TERMS = { data: { acceptedTermsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION } };
const ALL_MET = [
  { key: "email_verified", met: true },
  { key: "organization_payment", met: true },
  { key: "publisher_role", met: true },
  { key: "publisher_in_good_standing", met: true }
];
const ALL_PASSED = ["sdl_valid", "no_secrets", "images_allowed", "fixed_tags", "name_not_reserved"].map(key => ({ key, status: "passed", issues: [] }));
const LATEST_TAG_ISSUE = {
  message:
    'Service "web" uses nginx:latest, and the latest tag changes whenever the image is rebuilt. Pick a version tag such as nginx:1.2.3, or a digest, so the image can\'t change after the template is public.',
  service: "web",
  image: "nginx:latest"
};

const PROVIDER_KEY = "hf_abcdefghijklmnopqrstuv";
const README_KEY_ISSUE = {
  message: "Line 3 of the README holds a key or token in a format providers issue. Remove it before the template is public; anyone could read and use it.",
  field: "readme"
};

type ReadinessBody = {
  data: { requirements: { key: string; met: boolean }[]; checks: PublishCheck[]; canPublish: boolean; termsVersion: string; ranAt: string };
};
type ErrorBody = { message: string; code: string; data: Record<string, unknown> };

describe("Marketplace template publishing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 404 on both routes when template_marketplace is off and publishes nothing", async () => {
    const { owner, team, project, actAs } = await setup({ isMarketplaceOn: false });
    const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
    const asOwner = actAs(owner);

    const responses = await Promise.all([
      asOwner(`/v1/user-templates/${template.id}/publish-readiness`),
      asOwner(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404]);
    expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private", publishedAt: null });
  });

  it("answers 401 to a caller without a session", async () => {
    const { owner, team, project, read } = await setup();
    const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

    const responses = await Promise.all([
      read(`/v1/user-templates/${template.id}/publish-readiness`),
      read(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401]);
    expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private" });
  });

  describe("GET /v1/user-templates/{id}/publish-readiness", () => {
    it("tells a verified owner of a paying organization that a template passing its checks can be published", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION,
          requirements: ALL_MET,
          checks: ALL_PASSED,
          ranAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          canPublish: true
        }
      });
    });

    it("names an unverified email as unmet", async () => {
      const { owner, team, project, actAs } = await setup({ isEmailVerified: false });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(unmetOf(data)).toEqual(["email_verified"]);
      expect(data.canPublish).toBe(false);
    });

    it.each([
      { shape: "no payment at all", transactions: [] },
      { shape: "only a claimed coupon and a staff credit", transactions: [{ type: "coupon_claim" as const }, { type: "manual_credit" as const }] },
      { shape: "only a payment that failed and one refunded in full", transactions: [{ status: "failed" as const }, { status: "refunded" as const }] }
    ])("names the organization's payment as unmet for a team with $shape", async ({ transactions }) => {
      const { owner, team, project, actAs } = await setup({ hasPaid: false });
      await Promise.all(transactions.map(transaction => seedTransaction({ userId: owner.id, organizationId: team.id, ...transaction })));
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(unmetOf(data)).toEqual(["organization_payment"]);
    });

    it("does not count a payment made by the same person for another organization", async () => {
      const { owner, team, project, actAs } = await setup({ hasPaid: false });
      const personal = await seedPersonalOrganizationOf(owner);
      await seedTransaction({ userId: owner.id, organizationId: personal.id });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(unmetOf(data)).toEqual(["organization_payment"]);
    });

    it("lets a team's admin publish and names the role as unmet for a member who may edit", async () => {
      const { team, project, actAs, addMember } = await setup();
      const [admin, member] = await Promise.all([addMember("admin"), addMember("member")]);
      const template = await seedTemplate({ author: member, organizationId: team.id, projectId: project.id });

      const [forAdmin, forMember] = (await Promise.all(
        [admin, member].map(async user => (await actAs(user)(`/v1/user-templates/${template.id}/publish-readiness`)).json())
      )) as ReadinessBody[];

      expect(unmetOf(forAdmin.data)).toEqual([]);
      expect(forAdmin.data.canPublish).toBe(true);
      expect(unmetOf(forMember.data)).toEqual(["publisher_role"]);
      expect(forMember.data.canPublish).toBe(false);
    });

    it("names a suspended publisher as not in good standing", async () => {
      const { owner, team, project, actAs } = await setup();
      await seedPublisher({ organizationId: team.id, publishingSuspendedAt: new Date(), publishingSuspendedReason: "Spam" });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(unmetOf(data)).toEqual(["publisher_in_good_standing"]);
    });

    it("says what each failing check found and how to fix it", async () => {
      const { owner, team, project, actAs } = await setup({ teamName: "Akash Fans" });
      const template = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        title: "Official Llama",
        sdl: buildSdl({ image: "acme/xmrig", env: ["HF_TOKEN=hf_abcdefghijklmnopqrstuv", "PORT=8080"] })
      });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(data.canPublish).toBe(false);
      expect(data.requirements).toEqual(ALL_MET);
      expect(data.checks.map(({ key, status }) => ({ key, status }))).toEqual([
        { key: "sdl_valid", status: "passed" },
        { key: "no_secrets", status: "failed" },
        { key: "images_allowed", status: "failed" },
        { key: "fixed_tags", status: "failed" },
        { key: "name_not_reserved", status: "failed" }
      ]);
      expect(data.checks.flatMap(check => check.issues)).toEqual([
        {
          message:
            "web.env.HF_TOKEN holds a key or token in a format providers issue. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.",
          service: "web",
          variable: "HF_TOKEN"
        },
        {
          message: 'Service "web" runs acme/xmrig, which is a cryptocurrency miner. Public templates can\'t use it; change the image.',
          service: "web",
          image: "acme/xmrig"
        },
        {
          message:
            'Service "web" uses acme/xmrig without a tag, which means latest. Pick a version tag such as acme/xmrig:1.2.3, or a digest, so the image can\'t change after the template is public.',
          service: "web",
          image: "acme/xmrig"
        },
        { message: 'Titles can\'t contain "Official", which is reserved for Akash. Rename the template.', field: "title" },
        {
          message:
            'Templates are published under your organization\'s name, and "Akash Fans" contains "Akash", which is reserved for Akash. Rename the organization, or your username for a personal account.',
          field: "publisher_name"
        }
      ]);
      expect(JSON.stringify(data)).not.toContain("hf_abcdefghijklmnopqrstuv");
    });

    it("fails the SDL check of a legacy template whose SDL was never validated", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, sdl: "version: '2.0'" });

      const { data } = (await (await actAs(owner)(`/v1/user-templates/${template.id}/publish-readiness`)).json()) as ReadinessBody;

      expect(data.checks[0]).toEqual({ key: "sdl_valid", status: "failed", issues: [{ message: "The SDL defines no services" }] });
      expect(data.canPublish).toBe(false);
    });

    it("answers 403 to a member who may read the template but not change it, and 404 to a stranger", async () => {
      const { owner, team, project, actAs, addMember } = await setup();
      const viewer = await addMember("member", "viewer");
      const { user: stranger, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const responses = await Promise.all([
        actAs(viewer)(`/v1/user-templates/${template.id}/publish-readiness`),
        actAs(stranger, { organizationId: otherTeam.id })(`/v1/user-templates/${template.id}/publish-readiness`),
        actAs(owner)(`/v1/user-templates/${faker.string.uuid()}/publish-readiness`),
        actAs(owner)("/v1/user-templates/not-a-uuid/publish-readiness")
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404, 404, 400]);
    });
  });

  describe("POST /v1/user-templates/{id}/publish", () => {
    it("makes a team's template public and listed, records the acceptance, creates the publisher and stores the check results", async () => {
      const { owner, team, project, actAs, read } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(200);
      const { data } = (await response.json()) as { data: Record<string, unknown> & { currentVersion: { checkResults: { checks: unknown } } } };
      expect(data).toMatchObject({
        id: template.id,
        visibility: "public",
        isListed: true,
        publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        publisher: { name: team.name, slug: team.slug, type: "team", handle: team.slug }
      });
      expect(data.currentVersion.checkResults.checks).toEqual(ALL_PASSED);
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "public", isPublic: true, isListed: true, publishedAt: expect.any(Date) });
      expect(await acceptancesOf(template.id)).toEqual([
        {
          id: expect.any(String),
          templateId: template.id,
          userId: owner.id,
          organizationId: team.id,
          termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION,
          acceptedAt: expect.any(Date)
        }
      ]);
      expect(await publisherOf(team.id)).toMatchObject({ handle: team.slug, isVerified: false, publishingSuspendedAt: null, links: [], bio: null });
      expect((await versionsOf(template.id))[0].checkResults).toMatchObject({ checks: ALL_PASSED });

      const forVisitor = (await (await read(`/v1/user-templates/${template.id}`)).json()) as { data: { currentVersion: { checkResults: unknown } } };
      expect(forVisitor.data).toMatchObject({ id: template.id, visibility: "public", publisher: { handle: team.slug } });
      expect(forVisitor.data.currentVersion.checkResults).toBeNull();
    });

    it("publishes a personal template under a handle taken from the owner's username", async () => {
      const { actAs } = await setup();
      const username = `Sam.Rivera_${faker.string.alphanumeric(8)}`;
      const user = await seedUser({ ...createSignedUpUserInput(), username, emailVerified: true });
      const personal = await seedPersonalOrganizationOf(user);
      await seedTransaction({ userId: user.id, organizationId: personal.id });
      const template = await seedTemplate({ author: user, organizationId: personal.id });

      const response = await actAs(user, { organizationId: personal.id })(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(200);
      const handle = username.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      expect(await response.json()).toMatchObject({ data: { visibility: "public", publisher: { type: "personal", slug: null, handle } } });
      expect(await publisherOf(personal.id)).toMatchObject({ handle });
    });

    it("gives the second organization wanting a handle a numbered one", async () => {
      const { owner, team, project, actAs } = await setup();
      const other = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      await seedPublisher({ organizationId: other.organization.id, handle: team.slug });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(200);
      expect(await publisherOf(team.id)).toMatchObject({ handle: `${team.slug}-2` });
    });

    it("keeps the publisher, its handle and the first publication time when a template is published again", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);
      await asOwner(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });
      const first = await storedTemplate(template.id);
      const unpublish = await asOwner(`/v1/user-templates/${template.id}`, { method: "PATCH", body: { data: { visibility: "private" } } });
      const unpublished = await storedTemplate(template.id);

      const again = await asOwner(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect([unpublish.status, again.status]).toEqual([200, 200]);
      expect(unpublished).toMatchObject({ visibility: "private", isPublic: false, publishedAt: first.publishedAt });
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "public", publishedAt: first.publishedAt });
      expect(await acceptancesOf(template.id)).toHaveLength(2);
      expect(await publisherOf(team.id)).toMatchObject({ handle: team.slug });
    });

    it("lists a legacy public template once it goes through the gate", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public", isListed: false });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(200);
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "public", isListed: true, publishedAt: expect.any(Date) });
    });

    it("refuses with the unmet requirements and leaves the template private", async () => {
      const { owner, team, project, actAs } = await setup({ isEmailVerified: false, hasPaid: false });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "template_publish_requirements_unmet",
        data: {
          unmet: ["email_verified", "organization_payment"],
          requirements: [
            { key: "email_verified", met: false },
            { key: "organization_payment", met: false },
            { key: "publisher_role", met: true },
            { key: "publisher_in_good_standing", met: true }
          ]
        }
      });
      await expectNothingPublished(template.id, team.id);
    });

    it("refuses a team member who is neither owner nor admin, and lets an admin publish", async () => {
      const { team, project, actAs, addMember } = await setup();
      const [admin, member] = await Promise.all([addMember("admin"), addMember("member")]);
      const template = await seedTemplate({ author: member, organizationId: team.id, projectId: project.id });

      const asMember = await actAs(member)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });
      const afterMember = await storedTemplate(template.id);
      const asAdmin = await actAs(admin)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(asMember.status).toBe(403);
      expect(await asMember.json()).toMatchObject({ code: "template_publish_requirements_unmet", data: { unmet: ["publisher_role"] } });
      expect(afterMember).toMatchObject({ visibility: "private", publishedAt: null });
      expect(asAdmin.status).toBe(200);
      expect(await acceptancesOf(template.id)).toEqual([expect.objectContaining({ userId: admin.id })]);
    });

    it("refuses a suspended publisher", async () => {
      const { owner, team, project, actAs } = await setup();
      await seedPublisher({ organizationId: team.id, publishingSuspendedAt: new Date(), publishingSuspendedReason: "Spam" });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "template_publish_requirements_unmet", data: { unmet: ["publisher_in_good_standing"] } });
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private" });
    });

    it("refuses terms other than the current ones and names the current version", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: { data: { acceptedTermsVersion: "2020-01" } } });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "template_terms_version_mismatch", data: { termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION } });
      await expectNothingPublished(template.id, team.id);
    });

    it.each([
      { body: {} },
      { body: { data: {} } },
      { body: { data: { acceptedTermsVersion: "" } } },
      { body: { data: { acceptedTermsVersion: "x".repeat(17) } } }
    ])("answers 400 to the body $body", async ({ body }) => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body });

      expect(response.status).toBe(400);
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private" });
    });

    it("refuses a current version that fails the checks, with what they found, and leaves the template private", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, sdl: buildSdl({ image: "nginx:latest" }) });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body).toMatchObject({ code: "template_publish_checks_failed", message: LATEST_TAG_ISSUE.message });
      expect(body.data.checks).toContainEqual({ key: "fixed_tags", status: "failed", issues: [LATEST_TAG_ISSUE] });
      await expectNothingPublished(template.id, team.id);
      expect((await versionsOf(template.id))[0]).toMatchObject({ status: "live", checkResults: null });
    });

    it("refuses a template whose README holds a provider key, naming the line without repeating the key", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const templates = resolveTable("Templates");
      await db()
        .update(templates)
        .set({ description: `# Chat\n\nRun it with ${PROVIDER_KEY} as the hub token.` })
        .where(eq(templates.id, template.id));

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).not.toContain(PROVIDER_KEY);
      const body = JSON.parse(text) as ErrorBody;
      expect(body.code).toBe("template_publish_checks_failed");
      expect(body.data.checks).toContainEqual({ key: "no_secrets", status: "failed", issues: [README_KEY_ISSUE] });
      await expectNothingPublished(template.id, team.id);
    });

    it("refuses a template whose SDL keeps a provider key in a comment", async () => {
      const { owner, team, project, actAs } = await setup();
      const sdl = `# hub token ${PROVIDER_KEY}\n${buildSdl()}`;
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, sdl });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(400);
      const body = (await response.json()) as ErrorBody;
      expect(body.data.checks).toContainEqual({
        key: "no_secrets",
        status: "failed",
        issues: [
          {
            message:
              "Line 1 of the SDL holds a key or token in a format providers issue. Remove it before the template is public; anyone could read and use it.",
            field: "sdl"
          }
        ]
      });
      await expectNothingPublished(template.id, team.id);
    });

    it("refuses a legacy template that has no saved version to check", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, withoutVersion: true });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_publish_checks_failed",
        message: "This template has no saved version yet. Open Edit configuration and save it, then make it public."
      });
    });

    it("answers 403 to a reader and 404 to callers who cannot read the template, the owner acting for another organization included", async () => {
      const { owner, team, project, actAs, addMember } = await setup();
      const viewer = await addMember("member", "viewer");
      const personal = await seedPersonalOrganizationOf(owner);
      const { user: stranger, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const path = `/v1/user-templates/${template.id}/publish`;

      const responses = await Promise.all([
        actAs(viewer)(path, { method: "POST", body: ACCEPT_TERMS }),
        actAs(owner, { organizationId: personal.id })(path, { method: "POST", body: ACCEPT_TERMS }),
        actAs(stranger, { organizationId: otherTeam.id })(path, { method: "POST", body: ACCEPT_TERMS })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([403, 404, 404]);
      await expectNothingPublished(template.id, team.id);
    });

    it("answers 429 with when to try again once the caller published too many templates today", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      await seedAcceptances({ templateId: template.id, userId: owner.id, organizationId: team.id, count: 10, minutesAgo: 60 });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(22 * 3600);
      expect(await response.json()).toMatchObject({
        code: "template_rate_limited",
        message: "You reached the limit of 10 published templates per day. Try again in 23 hours.",
        data: { action: "publish", scope: "user", limit: 10, windowSeconds: 86400 }
      });
      expect(await storedTemplate(template.id)).toMatchObject({ visibility: "private" });
    });

    it("lets exactly one of two publishes through when only one fits under the limit", async () => {
      const { owner, team, project, actAs } = await setup();
      const [first, second] = await Promise.all([
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id }),
        seedTemplate({ author: owner, organizationId: team.id, projectId: project.id })
      ]);
      await seedAcceptances({ templateId: first.id, userId: owner.id, organizationId: team.id, count: 9, minutesAgo: 60 });
      const asOwner = actAs(owner);

      const responses = await Promise.all(
        [first, second].map(template => asOwner(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS }))
      );

      expect(responses.map(({ status }) => status).sort()).toEqual([200, 429]);
    });
  });

  describe("POST /v1/user-templates/{id}/versions on a public template", () => {
    it("saves a version that passes the checks as the current one, with what the checks found", async () => {
      const { owner, actAs, published } = await setupPublished();

      const response = await actAs(owner)(`/v1/user-templates/${published.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:1.26" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string; checkResults: { checks: unknown } } };
      expect(data).toMatchObject({ version: 2, status: "live" });
      expect(data.checkResults.checks).toEqual(ALL_PASSED);
      expect(await storedTemplate(published.id)).toMatchObject({ currentVersionId: data.id, sdl: buildSdl({ image: "nginx:1.26" }) });
    });

    it("stores a version that fails the checks without making it current, and answers why", async () => {
      const { owner, actAs, read, published } = await setupPublished();
      const before = await storedTemplate(published.id);

      const response = await actAs(owner)(`/v1/user-templates/${published.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:latest" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { checkResults: { checks: PublishCheck[] } } };
      expect(data).toMatchObject({ version: 2, status: "failed_checks", sdl: buildSdl({ image: "nginx:latest" }) });
      expect(data.checkResults.checks).toContainEqual({ key: "fixed_tags", status: "failed", issues: [LATEST_TAG_ISSUE] });
      expect(await storedTemplate(published.id)).toMatchObject({ currentVersionId: before.currentVersionId, sdl: before.sdl, visibility: "public" });

      const [forEditor, forVisitor, failedForVisitor, failedForEditor, templateForVisitor] = await Promise.all([
        actAs(owner)(`/v1/user-templates/${published.id}/versions`),
        read(`/v1/user-templates/${published.id}/versions`),
        read(`/v1/user-templates/${published.id}/versions/2`),
        actAs(owner)(`/v1/user-templates/${published.id}/versions/2`),
        read(`/v1/user-templates/${published.id}`)
      ]);
      const listedForEditor = (await forEditor.json()) as { data: { version: number; status: string; checkResults: unknown }[] };
      const listedForVisitor = (await forVisitor.json()) as { data: { version: number; status: string; checkResults: unknown }[] };

      expect(listedForEditor.data.map(({ version, status }) => ({ version, status }))).toEqual([
        { version: 2, status: "failed_checks" },
        { version: 1, status: "live" }
      ]);
      expect(listedForEditor.data[0].checkResults).toMatchObject({
        checks: expect.arrayContaining([expect.objectContaining({ key: "fixed_tags", status: "failed" })])
      });
      expect(listedForVisitor.data.map(({ version, status, checkResults }) => ({ version, status, checkResults }))).toEqual([
        { version: 1, status: "live", checkResults: null }
      ]);
      expect([failedForVisitor.status, failedForEditor.status]).toEqual([404, 200]);
      expect(await templateForVisitor.json()).toMatchObject({ data: { currentVersion: { version: 1, status: "live", checkResults: null } } });
    });

    it.each([
      { shape: "the failed version it was edited from", baseVersion: 2 },
      { shape: "the version that is still current", baseVersion: 1 }
    ])("saves the fix of a failed version edited from $shape as the next current version", async ({ baseVersion }) => {
      const { owner, actAs, published } = await setupPublished();
      const asOwner = actAs(owner);
      await asOwner(`/v1/user-templates/${published.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:latest" }), askedValues: [], baseVersion: 1 } }
      });

      const response = await asOwner(`/v1/user-templates/${published.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:1.26" }), askedValues: [], baseVersion } }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { id: string } };
      expect(data).toMatchObject({ version: 3, status: "live", changes: ["image_tag_changed"] });
      expect(await storedTemplate(published.id)).toMatchObject({ currentVersionId: data.id });
    });

    it("stores a version whose README holds a provider key as failed, and keeps the README readers see", async () => {
      const { owner, actAs, read, published } = await setupPublished();

      const response = await actAs(owner)(`/v1/user-templates/${published.id}/versions`, {
        method: "POST",
        body: {
          data: { sdl: buildSdl({ image: "nginx:1.26" }), readme: `# Chat\n\nRun it with ${PROVIDER_KEY} as the hub token.`, askedValues: [], baseVersion: 1 }
        }
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: { status: string; checkResults: { checks: PublishCheck[] } } };
      expect(data.status).toBe("failed_checks");
      expect(data.checkResults.checks).toContainEqual({ key: "no_secrets", status: "failed", issues: [README_KEY_ISSUE] });
      const forVisitor = await read(`/v1/user-templates/${published.id}`);
      expect(await forVisitor.text()).not.toContain(PROVIDER_KEY);
    });

    it("answers 409 to a fix edited from a failed version once another version became current after it", async () => {
      const { owner, actAs, published } = await setupPublished();
      const asOwner = actAs(owner);
      const save = (image: string, baseVersion: number) =>
        asOwner(`/v1/user-templates/${published.id}/versions`, { method: "POST", body: { data: { sdl: buildSdl({ image }), askedValues: [], baseVersion } } });
      await save("nginx:latest", 1);
      await save("nginx:1.26", 1);

      const response = await save("nginx:1.27", 2);

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "template_version_conflict" });
      expect((await versionsOf(published.id)).map(({ version, status }) => ({ version, status }))).toEqual([
        { version: 1, status: "live" },
        { version: 2, status: "failed_checks" },
        { version: 3, status: "live" }
      ]);
    });

    it("runs no publish check on a version of a private template", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:latest" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ data: { version: 2, status: "live", checkResults: null } });
    });

    it("answers 429 with when to try again once the caller saved too many versions this hour", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      await seedVersions({ templateId: template.id, createdById: owner.id, count: 60, minutesAgo: 30 });

      const response = await actAs(owner)(`/v1/user-templates/${template.id}/versions`, {
        method: "POST",
        body: { data: { sdl: buildSdl({ image: "nginx:1.26" }), askedValues: [], baseVersion: 1 } }
      });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(29 * 60);
      expect(await response.json()).toMatchObject({
        code: "template_rate_limited",
        message: "You reached the limit of 60 saved versions per hour. Try again in 30 minutes.",
        data: { action: "version", scope: "user", limit: 60, windowSeconds: 3600 }
      });
      expect(await versionsOf(template.id)).toHaveLength(61);
    });
  });

  describe("POST /v1/user-templates", () => {
    it("answers 429 with when to try again once the caller created too many templates this hour", async () => {
      const { owner, team, project, actAs } = await setup();
      await Promise.all(
        Array.from({ length: 20 }, () => seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, withoutVersion: true }))
      );

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } });

      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(59 * 60);
      expect(await response.json()).toMatchObject({
        code: "template_rate_limited",
        message: "You reached the limit of 20 new templates per hour. Try again in 1 hour.",
        data: { action: "create", scope: "user", limit: 20, windowSeconds: 3600 }
      });
      expect(await templatesIn(team.id)).toHaveLength(20);
    });

    it("counts a template's first version as the template, so a caller at the version limit still creates one", async () => {
      const { owner, team, project, actAs } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      await seedVersions({ templateId: template.id, createdById: owner.id, count: 60, minutesAgo: 30 });

      const response = await actAs(owner)("/v1/user-templates", { method: "POST", body: { data: { title: "Web", sdl: buildSdl() } } });

      expect(response.status).toBe(201);
    });
  });

  describe("PATCH /v1/user-templates/{id} on a public template", () => {
    it("refuses a title with a reserved word and keeps the title", async () => {
      const { owner, actAs, published } = await setupPublished();

      const response = await actAs(owner)(`/v1/user-templates/${published.id}`, { method: "PATCH", body: { data: { title: "0fficial Llama" } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "template_publish_checks_failed",
        data: {
          checks: [
            {
              key: "name_not_reserved",
              status: "failed",
              issues: [{ message: 'Titles can\'t contain "Official", which is reserved for Akash. Rename the template.', field: "title" }]
            }
          ]
        }
      });
      expect(await storedTemplate(published.id)).toMatchObject({ title: published.title });
    });

    it("renames it to an ordinary title, and lets a private template take any title", async () => {
      const { owner, team, project, actAs, published } = await setupPublished();
      const privateTemplate = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id });
      const asOwner = actAs(owner);

      const responses = await Promise.all([
        asOwner(`/v1/user-templates/${published.id}`, { method: "PATCH", body: { data: { title: "Llama 3.1 Chat" } } }),
        asOwner(`/v1/user-templates/${privateTemplate.id}`, { method: "PATCH", body: { data: { title: "Official Llama" } } })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([200, 200]);
      expect(await storedTemplate(published.id)).toMatchObject({ title: "Llama 3.1 Chat" });
      expect(await storedTemplate(privateTemplate.id)).toMatchObject({ title: "Official Llama" });
    });

    it("keeps when the template first went public after it is moved to the organization", async () => {
      const { owner, actAs, published } = await setupPublished();
      const { publishedAt } = await storedTemplate(published.id);

      const response = await actAs(owner)(`/v1/user-templates/${published.id}`, { method: "PATCH", body: { data: { visibility: "organization" } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { visibility: "organization", publishedAt: publishedAt!.toISOString() } });
      expect(await storedTemplate(published.id)).toMatchObject({ visibility: "organization", isPublic: false, publishedAt });
    });
  });

  describe("POST /v1/user/saveTemplate on a template that went through the gate", () => {
    it("refuses a save that fails the publish checks while template_marketplace is on", async () => {
      const { owner, actAs, published } = await setupPublished();

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(published, buildSdl({ image: "nginx:latest" })) });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_publish_checks_failed" });
      expect(await versionsOf(published.id)).toHaveLength(1);
      expect(await storedTemplate(published.id)).toMatchObject({ sdl: published.sdl });
    });

    it("saves a version that passes the publish checks while template_marketplace is on", async () => {
      const { owner, actAs, published } = await setupPublished();

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(published, buildSdl({ image: "nginx:1.26" })) });

      expect(response.status).toBe(200);
      const versions = await versionsOf(published.id);
      expect(versions.map(({ version, status }) => ({ version, status }))).toEqual([
        { version: 1, status: "live" },
        { version: 2, status: "live" }
      ]);
      expect(versions[1].checkResults?.checks.map(({ key, status }) => ({ key, status }))).toEqual(ALL_PASSED.map(({ key, status }) => ({ key, status })));
    });

    it("refuses a save whose description, shown as the README, holds a provider key", async () => {
      const { owner, actAs, published } = await setupPublished();
      const body = { ...legacySaveOf(published, buildSdl({ image: "nginx:1.26" })), description: `Run it with ${PROVIDER_KEY}` };

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "template_publish_checks_failed" });
      expect(await versionsOf(published.id)).toHaveLength(1);
    });

    it("refuses to make a template public again once it was taken out of the gallery, and still saves it as private", async () => {
      const { owner, actAs, published } = await setupPublished();
      const madePrivate = await actAs(owner)(`/v1/user-templates/${published.id}`, { method: "PATCH", body: { data: { visibility: "private" } } });
      expect(madePrivate.status).toBe(200);
      const save = legacySaveOf(published, buildSdl({ image: "nginx:latest" }));

      const madePublicAgain = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: save });

      expect(madePublicAgain.status).toBe(409);
      expect(await madePublicAgain.json()).toMatchObject({ code: "template_publish_gate_required" });
      expect(await versionsOf(published.id)).toHaveLength(1);
      expect(await storedTemplate(published.id)).toMatchObject({ visibility: "private", isPublic: false, sdl: published.sdl });

      const keptPrivate = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: { ...save, isPublic: false } });

      expect(keptPrivate.status).toBe(200);
      expect(await storedTemplate(published.id)).toMatchObject({ visibility: "private", isPublic: false, sdl: save.sdl });
    });

    it("saves as it always did while template_marketplace is off", async () => {
      const { owner, team, project, actAs } = await setup({ isMarketplaceOn: false });
      const published = await seedTemplate({
        author: owner,
        organizationId: team.id,
        projectId: project.id,
        visibility: "public",
        publishedAt: new Date("2026-11-10T08:00:00.000Z")
      });

      const response = await actAs(owner)("/v1/user/saveTemplate", { method: "POST", body: legacySaveOf(published, buildSdl({ image: "nginx:latest" })) });

      expect(response.status).toBe(200);
      expect((await versionsOf(published.id)).map(({ version, status, checkResults }) => ({ version, status, checkResults }))).toEqual([
        { version: 1, status: "live", checkResults: null },
        { version: 2, status: "live", checkResults: null }
      ]);
      expect(await storedTemplate(published.id)).toMatchObject({ sdl: buildSdl({ image: "nginx:latest" }) });
    });
  });

  function unmetOf(readiness: ReadinessBody["data"]) {
    return readiness.requirements.filter(requirement => !requirement.met).map(requirement => requirement.key);
  }

  async function expectNothingPublished(templateId: string, organizationId: string) {
    expect(await storedTemplate(templateId)).toMatchObject({ visibility: "private", isPublic: false, publishedAt: null });
    expect(await acceptancesOf(templateId)).toEqual([]);
    expect(await publisherOf(organizationId)).toBeUndefined();
  }

  function legacySaveOf(template: { id: string; title: string }, sdl: string) {
    return { id: template.id, sdl, title: template.title, cpu: 1000, ram: 1024 * MEBIBYTE, storage: 2 * GIBIBYTE, isPublic: true };
  }

  function buildSdl({ image = "nginx:1.25", env }: { image?: string; env?: string[] } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      `    image: ${image}`,
      ...(env ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
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

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  async function seedTemplate(input: {
    author: UserOutput;
    organizationId: string;
    projectId?: string;
    title?: string;
    sdl?: string;
    visibility?: TemplateVisibility;
    isListed?: boolean;
    publishedAt?: Date;
    withoutVersion?: boolean;
  }) {
    const { author, sdl = buildSdl(), visibility = "private", withoutVersion = false, title = "Llama Chat", ...template } = input;
    const [row] = await db()
      .insert(resolveTable("Templates"))
      .values({
        ...template,
        title,
        sdl,
        visibility,
        isPublic: visibility === "public",
        userId: author.userId,
        authorId: author.id,
        cpu: 500,
        ram: 512 * MEBIBYTE,
        storage: GIBIBYTE
      })
      .returning();

    if (!withoutVersion) {
      await container.resolve(TemplateVersionRepository).appendVersion({ templateId: row.id, sdl, createdById: author.id });
    }

    return await storedTemplate(row.id);
  }

  async function seedTransaction(input: {
    userId: string;
    organizationId: string;
    type?: "payment_intent" | "coupon_claim" | "manual_credit";
    status?: "succeeded" | "failed" | "refunded";
  }) {
    await db()
      .insert(resolveTable("StripeTransactions"))
      .values({ type: "payment_intent", status: "succeeded", amount: 2000, ...input });
  }

  async function seedPublisher(input: { organizationId: string; handle?: string; publishingSuspendedAt?: Date; publishingSuspendedReason?: string }) {
    await db()
      .insert(resolveTable("TemplatePublishers"))
      .values({ handle: `publisher-${faker.string.alphanumeric(10).toLowerCase()}`, ...input });
  }

  async function seedAcceptances(input: { templateId: string; userId: string; organizationId: string; count: number; minutesAgo: number }) {
    const { count, minutesAgo, ...acceptance } = input;
    await db()
      .insert(resolveTable("TemplateTermsAcceptances"))
      .values(
        Array.from({ length: count }, () => ({
          ...acceptance,
          termsVersion: COMMUNITY_TEMPLATE_TERMS_VERSION,
          acceptedAt: sql`now() - make_interval(mins => ${minutesAgo})`
        }))
      );
  }

  async function seedVersions(input: { templateId: string; createdById: string; count: number; minutesAgo: number }) {
    const { count, minutesAgo, ...version } = input;
    await db()
      .insert(resolveTable("TemplateVersions"))
      .values(
        Array.from({ length: count }, (_, index) => ({
          ...version,
          version: index + 2,
          sdl: buildSdl(),
          createdAt: sql`now() - make_interval(mins => ${minutesAgo})`
        }))
      );
  }

  async function storedTemplate(id: string) {
    const templates = resolveTable("Templates");
    const [row] = await db().select().from(templates).where(eq(templates.id, id));

    return row;
  }

  async function templatesIn(organizationId: string) {
    const templates = resolveTable("Templates");

    return await db().select().from(templates).where(eq(templates.organizationId, organizationId));
  }

  async function versionsOf(templateId: string) {
    const versions = resolveTable("TemplateVersions");

    return await db().select().from(versions).where(eq(versions.templateId, templateId)).orderBy(asc(versions.version));
  }

  async function acceptancesOf(templateId: string) {
    const acceptances = resolveTable("TemplateTermsAcceptances");

    return await db().select().from(acceptances).where(eq(acceptances.templateId, templateId));
  }

  async function publisherOf(organizationId: string) {
    const publishers = resolveTable("TemplatePublishers");
    const [row] = await db().select().from(publishers).where(eq(publishers.organizationId, organizationId));

    return row;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setupPublished() {
    const context = await setup();
    const template = await seedTemplate({ author: context.owner, organizationId: context.team.id, projectId: context.project.id });
    const response = await context.actAs(context.owner)(`/v1/user-templates/${template.id}/publish`, { method: "POST", body: ACCEPT_TERMS });

    if (response.status !== 200) throw new Error(`Publishing the seeded template answered ${response.status}`);

    return { ...context, published: await storedTemplate(template.id) };
  }

  async function setup({
    isMarketplaceOn = true,
    isEmailVerified = true,
    hasPaid = true,
    teamName
  }: { isMarketplaceOn?: boolean; isEmailVerified?: boolean; hasPaid?: boolean; teamName?: string } = {}) {
    const {
      user: owner,
      organization: team,
      project
    } = await seedOrganizationWithOwner({
      user: { ...createSignedUpUserInput(), emailVerified: isEmailVerified },
      ...(teamName && { name: teamName })
    });
    if (hasPaid) await seedTransaction({ userId: owner.id, organizationId: team.id });
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

    const addMember = async (role: "member" | "admin", projectRole: "member" | "viewer" = "member") => {
      const user = await seedUser({ ...createSignedUpUserInput(), emailVerified: true });
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: projectRole });

      return user;
    };

    return { owner, team, project, read, actAs, addMember };
  }
});
