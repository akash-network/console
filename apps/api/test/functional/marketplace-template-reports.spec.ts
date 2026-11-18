import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedTemplate, seedTemplatePublisher, seedTemplateReport, seedTemplateVersion } from "@test/seeders/db/template.seeder";
import { seedPersonalOrganizationOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type ErrorBody = { message: string; code: string; data: Record<string, unknown> };
type ReportBody = { data: { id: string; reason: string; createdAt: string } };

const REPORT = { data: { reason: "malware_or_miner", details: "The image downloads xmrig from a pastebin link." } };

describe("Marketplace template reports", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  it("answers 404 when template_marketplace is off and files nothing", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup({ isMarketplaceOn: false });
    const { template } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(404);
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 401 to a caller without a session and files nothing", async () => {
    const { read, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate();

    const response = await read(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(401);
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("files an open report against the current version and answers nothing about who filed it", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template, version } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(201);
    const body = (await response.json()) as ReportBody;
    expect(body).toEqual({ data: { id: expect.any(String), reason: "malware_or_miner", createdAt: expect.any(String) } });
    expect(await storedReportsOf(template.id)).toEqual([
      {
        id: body.data.id,
        templateId: template.id,
        templateVersionId: version.id,
        reporterUserId: reporter.id,
        reporterOrganizationId: reporterTeam.id,
        reason: "malware_or_miner",
        details: "The image downloads xmrig from a pastebin link.",
        status: "open",
        assignee: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(body.data.createdAt)
      }
    ]);
  });

  it("files a report without details", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: { data: { reason: "broken", details: "   " } } });

    expect(response.status).toBe(201);
    expect(await storedReportsOf(template.id)).toMatchObject([{ reason: "broken", details: null }]);
  });

  it("shows the publisher nothing of a report filed against its template", async () => {
    const { owner, team, reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate();
    await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });
    const asOwner = actAs(owner, team.id);

    const responses = await Promise.all([
      asOwner(`/v1/user-templates/${template.id}`),
      asOwner(`/v1/user-templates/${template.id}/versions`),
      asOwner(`/v1/user-templates/${template.id}/versions/1`),
      asOwner("/v1/user-templates"),
      asOwner(reportsOf(template.id))
    ]);
    const answered = (await Promise.all(responses.slice(0, 4).map(response => response.text()))).join("\n");

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200, 404]);
    expect(answered).not.toContain(reporter.id);
    expect(answered).not.toContain(reporterTeam.id);
    expect(answered).not.toContain("xmrig");
    expect(answered.toLowerCase()).not.toContain("report");
  });

  it.each([
    { name: "an unknown reason", body: { data: { reason: "rude" } } },
    { name: "no reason", body: { data: { details: "Something." } } },
    { name: "details over 1000 characters", body: { data: { reason: "spam", details: "d".repeat(1001) } } },
    { name: "details holding control characters", body: { data: { reason: "spam", details: `Odd${String.fromCharCode(27)}[31m text` } } }
  ])("answers 400 to $name and files nothing", async ({ body }) => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body });

    expect(response.status).toBe(400);
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 400 to an id that is not a uuid", async () => {
    const { reporter, reporterTeam, actAs } = await setup();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf("not-a-uuid"), { method: "POST", body: REPORT });

    expect(response.status).toBe(400);
  });

  it("answers 404 for a template the reporter cannot read: unknown, private, hidden, or of a suspended publisher", async () => {
    const { owner, team, project, reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { user: suspendedOwner, organization: suspended } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    await seedTemplatePublisher({ organizationId: suspended.id, publishingSuspendedAt: new Date(), publishingSuspendedReason: "Spam" });
    const privateTemplate = await seedTemplate({ organizationId: team.id, projectId: project.id, userId: owner.userId, authorId: owner.id });
    const [{ template: hidden }, { template: ofSuspended }] = await Promise.all([
      seedPublicTemplate({ moderationStatus: "hidden" }),
      seedPublicTemplate({ organizationId: suspended.id, projectId: null, userId: suspendedOwner.userId, authorId: suspendedOwner.id })
    ]);
    const asReporter = actAs(reporter, reporterTeam.id);

    const responses = await Promise.all(
      [faker.string.uuid(), privateTemplate.id, hidden.id, ofSuspended.id].map(id => asReporter(reportsOf(id), { method: "POST", body: REPORT }))
    );

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    expect(await Promise.all([privateTemplate.id, hidden.id, ofSuspended.id].map(storedReportsOf))).toEqual([[], [], []]);
  });

  it("answers 410 with the title for a removed template that was once public", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate({ title: "Llama 3.1 Chat", moderationStatus: "removed" });

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({ code: "template_removed", data: { title: "Llama 3.1 Chat" } });
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 409 to a member reporting a template of their organization that is not public", async () => {
    const { owner, team, project, actAs } = await setup();
    const template = await seedTemplate({ organizationId: team.id, projectId: project.id, userId: owner.userId, authorId: owner.id });
    await seedTemplateVersion({ templateId: template.id });

    const response = await actAs(owner, team.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "template_not_reportable", message: "Only public templates can be reported" });
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 409 for a public template that has no version to report", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template } = await seedPublicTemplate({ withoutVersion: true });

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "template_not_reportable" });
  });

  it("answers 403 to members of the publishing organization, whichever organization they act for", async () => {
    const { owner, team, actAs, seedPublicTemplate } = await setup();
    const member = await seedUser({ ...createSignedUpUserInput(), emailVerified: true });
    await seedOrganizationMember({ organizationId: team.id, userId: member.id, role: "viewer" });
    const personal = await seedPersonalOrganizationOf(member);
    const { template } = await seedPublicTemplate();

    const responses = await Promise.all([
      actAs(owner, team.id)(reportsOf(template.id), { method: "POST", body: REPORT }),
      actAs(member, team.id)(reportsOf(template.id), { method: "POST", body: REPORT }),
      actAs(member, personal.id)(reportsOf(template.id), { method: "POST", body: REPORT })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
    expect(await responses[2].json()).toMatchObject({
      code: "template_report_own_organization",
      message: "You can't report a template your own organization published. Change it or delete it instead."
    });
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 409 to a second report of the same version, then files one against the next version", async () => {
    const { owner, reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { template, version } = await seedPublicTemplate();
    const asReporter = actAs(reporter, reporterTeam.id);
    const first = await asReporter(reportsOf(template.id), { method: "POST", body: REPORT });

    const second = await asReporter(reportsOf(template.id), { method: "POST", body: { data: { reason: "spam" } } });
    const nextVersion = await seedTemplateVersion({ templateId: template.id, version: 2, createdById: owner.id });
    const third = await asReporter(reportsOf(template.id), { method: "POST", body: { data: { reason: "broken" } } });

    expect([first.status, second.status, third.status]).toEqual([201, 409, 201]);
    expect(await second.json()).toMatchObject({ code: "template_already_reported", message: "You already reported this version of the template" });
    expect(await storedReportsOf(template.id)).toMatchObject([
      { templateVersionId: version.id, reason: "malware_or_miner" },
      { templateVersionId: nextVersion.id, reason: "broken" }
    ]);
  });

  it("lets two users report the same version", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { user: other, organization: otherTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const { template } = await seedPublicTemplate();

    const responses = await Promise.all([
      actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT }),
      actAs(other, otherTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT })
    ]);

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    expect(await storedReportsOf(template.id)).toHaveLength(2);
  });

  it("answers 429 with Retry-After once the reporter filed ten reports in a day, and files nothing more", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const { organization: elsewhere } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    await seedEarlierReports({ count: 10, reporterUserId: reporter.id, reporterOrganizationId: elsewhere.id });
    const { template } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(23 * 3600);
    const body = (await response.json()) as ErrorBody;
    expect(body).toMatchObject({ code: "template_rate_limited", data: { action: "report", scope: "user", limit: 10, windowSeconds: 86400 } });
    expect(body.message).toMatch(/^You reached the limit of 10 template reports per day\. Try again in /);
    expect(await storedReportsOf(template.id)).toEqual([]);
  });

  it("answers 429 once the reporter's organization filed thirty reports in a day", async () => {
    const { reporter, reporterTeam, actAs, seedPublicTemplate } = await setup();
    const colleagues = await Promise.all([seedUser(), seedUser(), seedUser()]);
    for (const colleague of colleagues) await seedEarlierReports({ count: 10, reporterUserId: colleague.id, reporterOrganizationId: reporterTeam.id });
    const { template } = await seedPublicTemplate();

    const response = await actAs(reporter, reporterTeam.id)(reportsOf(template.id), { method: "POST", body: REPORT });

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "template_rate_limited", data: { action: "report", scope: "organization", limit: 30 } });
  });

  function reportsOf(templateId: string) {
    return `/v1/user-templates/${templateId}/reports`;
  }

  function db() {
    return container.resolve<ApiPgDatabase>(POSTGRES_DB);
  }

  async function storedReportsOf(templateId: string) {
    const reports = resolveTable("TemplateReports");

    return await db().select().from(reports).where(eq(reports.templateId, templateId)).orderBy(reports.createdAt);
  }

  async function seedEarlierReports(input: { count: number; reporterUserId: string; reporterOrganizationId: string }) {
    const { count, ...reporter } = input;

    for (let index = 0; index < count; index++) {
      const template = await seedTemplate({ visibility: "public" });
      const version = await seedTemplateVersion({ templateId: template.id });
      await seedTemplateReport({ ...reporter, templateId: template.id, templateVersionId: version.id });
    }
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const { user: owner, organization: team, project } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const { user: reporter, organization: reporterTeam } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
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

    const actAs = (user: UserOutput, organizationId: string) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string, init: { method?: string; body?: unknown } = {}) =>
        request(path, { authorization: `Bearer ${token}`, "x-organization-id": organizationId }, init);
    };

    const seedPublicTemplate = async ({ withoutVersion = false, ...overrides }: Parameters<typeof seedTemplate>[0] & { withoutVersion?: boolean } = {}) => {
      const template = await seedTemplate({
        organizationId: team.id,
        projectId: project.id,
        userId: owner.userId,
        authorId: owner.id,
        visibility: "public",
        publishedAt: new Date(),
        ...overrides
      });
      const version = withoutVersion ? undefined : await seedTemplateVersion({ templateId: template.id, createdById: owner.id });

      return { template, version: version! };
    };

    return { owner, team, project, reporter, reporterTeam, read, actAs, seedPublicTemplate };
  }
});
