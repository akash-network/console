import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { app } from "@src/rest-app";
import type { TemplateUsageEventInput } from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import { TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import type { TemplateVisibility } from "@src/user/model-schemas/template/template.schema";
import type { UserOutput } from "@src/user/repositories";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe("Marketplace template insights", () => {
  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/user-templates/{id}/views", () => {
    it("counts a viewer once a day for each kind", async () => {
      const { team, project, owner, outsider, request } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });

      const statuses = await Promise.all([
        request(outsider, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } }),
        request(outsider, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } }),
        request(outsider, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "configure_open" } } })
      ]);

      expect(statuses.map(({ status }) => status)).toEqual([204, 204, 204]);
      expect((await storedViews(template.id)).map(({ kind }) => kind).sort()).toEqual(["configure_open", "page_view"]);
    });

    it("marks the views of the organization that publishes the template", async () => {
      const { team, project, owner, outsider, request } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });

      const responses = await Promise.all([
        request(owner, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } }),
        request(outsider, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "configure_open" } } })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([204, 204]);
      expect(
        (await storedViews(template.id)).map(({ kind, fromPublisher }) => ({ kind, fromPublisher })).sort((left, right) => left.kind.localeCompare(right.kind))
      ).toEqual([
        { kind: "configure_open", fromPublisher: false },
        { kind: "page_view", fromPublisher: true }
      ]);
    });

    it("answers 401 without a session, 404 for a template the caller may not read, and 400 for an unknown kind", async () => {
      const { team, project, owner, outsider, request, anonymous } = await setup();
      const hidden = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "private" });
      const shown = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });

      const responses = await Promise.all([
        anonymous(`/v1/user-templates/${shown.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } }),
        request(outsider, `/v1/user-templates/${hidden.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } }),
        request(outsider, `/v1/user-templates/${shown.id}/views`, { method: "POST", body: { data: { kind: "deploy" } } })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 404, 400]);
      expect(await storedViews(shown.id)).toEqual([]);
    });

    it("answers 404 when template_marketplace is off", async () => {
      const { team, project, owner, outsider, request } = await setup({ isMarketplaceOn: false });
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });

      const response = await request(outsider, `/v1/user-templates/${template.id}/views`, { method: "POST", body: { data: { kind: "page_view" } } });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /v1/user-templates/{id}/insights", () => {
    it("tells the publisher how the template was viewed and deployed, without its own organization's deployments", async () => {
      const { team, project, owner, outsider, request } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });
      const [first, second] = await seedVersions(template.id);
      vi.useFakeTimers({ toFake: ["Date"], now: new Date() });
      const today = new Date();
      await seedViews(template.id, [
        { kind: "page_view", viewedOn: dayOf(today), viewers: 3 },
        { kind: "configure_open", viewedOn: dayOf(today), viewers: 2 },
        { kind: "page_view", viewedOn: dayOf(subDays(today, 9)), viewers: 4 },
        { kind: "page_view", viewedOn: dayOf(today), viewers: 5, network: "sandbox" }
      ]);
      await seedDeployment(template.id, { versionId: first.id, organizationId: outsider.organizationId, deployedAt: subDays(today, 3), leasedAt: subDays(today, 3), stillRunning: true });
      await seedDeployment(template.id, { versionId: second.id, organizationId: outsider.organizationId, deployedAt: today, leasedAt: today });
      await seedDeployment(template.id, { versionId: second.id, organizationId: outsider.organizationId, deployedAt: today });
      await seedDeployment(template.id, { versionId: second.id, organizationId: team.id, deployedAt: today, leasedAt: today });
      await seedDeployment(template.id, { versionId: first.id, organizationId: outsider.organizationId, deployedAt: subDays(today, 10) });

      const response = await request(owner, `/v1/user-templates/${template.id}/insights?days=7`);
      const body = (await response.json()) as { data: Record<string, unknown> & { daily: { day: string }[] } };

      expect(response.status).toBe(200);
      expect(body.data).toMatchObject({
        days: 7,
        from: dayOf(subDays(today, 6)),
        to: dayOf(today),
        current: { views: 3, configureOpens: 2, deploys: 3, leases: 2, decidedLeases: 1, stillRunning: 1, forks: 0, leaseRate: null, stillRunningRate: null },
        previous: { views: 4, deploys: 1, leases: 0 },
        versions: [
          { version: 1, deploys: 2, leases: 1, decidedLeases: 1, stillRunning: 1 },
          { version: 2, deploys: 2, leases: 1, decidedLeases: 0, stillRunning: 0 }
        ],
        hints: []
      });
      expect(body.data.daily).toHaveLength(7);
      expect(body.data.daily.at(-1)).toEqual({ day: dayOf(today), views: 3, configureOpens: 2, deploys: 2, leases: 1, stillRunning: 0 });
    });

    it.each([
      { visibility: "public" as const, views: 3 },
      { visibility: "organization" as const, views: 5 }
    ])("counts the publishing organization's views of a $visibility template as $views of 5", async ({ visibility, views }) => {
      const { team, project, owner, request } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility });
      vi.useFakeTimers({ toFake: ["Date"], now: new Date() });
      const today = dayOf(new Date());
      await seedViews(template.id, [
        { kind: "page_view", viewedOn: today, viewers: 3 },
        { kind: "page_view", viewedOn: today, viewers: 2, fromPublisher: true }
      ]);

      const response = await request(owner, `/v1/user-templates/${template.id}/insights?days=7`);
      const body = (await response.json()) as { data: { current: { views: number } } };

      expect(response.status).toBe(200);
      expect(body.data.current.views).toBe(views);
    });

    it.each(["7", "30", "90"])("covers %s days", async days => {
      const { team, project, owner, request } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "organization" });

      const response = await request(owner, `/v1/user-templates/${template.id}/insights?days=${days}`);
      const body = (await response.json()) as { data: { daily: unknown[] } };

      expect(response.status).toBe(200);
      expect(body.data.daily).toHaveLength(Number(days));
    });

    it("refuses whoever may not change the template", async () => {
      const { team, project, owner, outsider, addMember, request, anonymous } = await setup();
      const template = await seedTemplate({ author: owner, organizationId: team.id, projectId: project.id, visibility: "public" });
      const viewer = await addMember("viewer");

      const responses = await Promise.all([
        anonymous(`/v1/user-templates/${template.id}/insights`),
        request(outsider, `/v1/user-templates/${template.id}/insights`),
        request(viewer, `/v1/user-templates/${template.id}/insights`),
        request(owner, `/v1/user-templates/${template.id}/insights?days=14`)
      ]);

      expect(responses.map(({ status }) => status)).toEqual([401, 403, 403, 400]);
    });
  });

  function dayOf(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  async function storedViews(templateId: string) {
    const views = resolveTable("TemplateViewEvents");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(views).where(eq(views.templateId, templateId));
  }

  async function seedViews(
    templateId: string,
    days: { kind: "page_view" | "configure_open"; viewedOn: string; viewers: number; network?: string; fromPublisher?: boolean }[]
  ) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("TemplateViewEvents"))
      .values(
        days.flatMap(({ kind, viewedOn, viewers, network = "mainnet", fromPublisher = false }) =>
          Array.from({ length: viewers }, () => ({
            templateId,
            kind,
            viewedOn,
            network,
            fromPublisher,
            viewerKey: faker.string.hexadecimal({ length: 64, prefix: "" })
          }))
        )
      );
  }

  async function seedDeployment(
    templateId: string,
    input: { versionId: string; organizationId: string; deployedAt: Date; leasedAt?: Date; stillRunning?: boolean }
  ) {
    const deployment = { source: "console" as const, templateRef: templateId, templateVersionId: input.versionId, organizationId: input.organizationId };
    const deploymentSettingId = faker.string.uuid();
    const events: TemplateUsageEventInput[] = [{ ...deployment, action: "deploy", createdAt: input.deployedAt, deploymentSettingId, network: "mainnet" }];

    if (input.leasedAt) events.push({ ...deployment, action: "lease_created", createdAt: input.leasedAt, deploymentSettingId, network: "mainnet" });
    if (input.stillRunning) events.push({ ...deployment, action: "still_running_24h", createdAt: input.deployedAt, deploymentSettingId, network: "mainnet" });

    await container.resolve<ApiPgDatabase>(POSTGRES_DB).insert(resolveTable("TemplateUsageEvents")).values(events);
  }

  async function seedVersions(templateId: string) {
    const versions = container.resolve(TemplateVersionRepository);
    const first = await versions.appendVersion({ templateId, sdl: "version: '2.0'" });
    const second = await versions.appendVersion({ templateId, sdl: "version: '2.1'" });

    return [first, second] as const;
  }

  async function seedTemplate(input: { author: UserOutput; organizationId: string; projectId: string; visibility: TemplateVisibility }) {
    const { author, ...template } = input;
    const [row] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Templates"))
      .values({
        sdl: "version: '2.0'",
        ...template,
        userId: author.userId,
        authorId: author.id,
        isPublic: input.visibility === "public",
        title: faker.lorem.words(3),
        cpu: 1000,
        ram: 1024,
        storage: 1024
      })
      .returning();

    return row;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setup({ isMarketplaceOn = true }: { isMarketplaceOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const { user: outsiderUser, organization: outsiderOrganization } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const outsider = Object.assign(outsiderUser, { organizationId: outsiderOrganization.id });
    const tokens = new Map<string, string>();
    const organizationOf = new Map<string, string>([
      [owner.id, team.id],
      [outsider.id, outsiderOrganization.id]
    ]);

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => isMarketplaceOn || flag !== FeatureFlags.TEMPLATE_MARKETPLACE);

    const request = (user: UserOutput, path: string, init: { method?: string; body?: unknown } = {}) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return app.request(path, {
        method: init.method ?? "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "x-organization-id": organizationOf.get(user.id) ?? team.id,
          ...(init.body !== undefined && { "content-type": "application/json" })
        },
        ...(init.body !== undefined && { body: JSON.stringify(init.body) })
      });
    };

    const anonymous = (path: string, init: { method?: string; body?: unknown } = {}) =>
      app.request(path, {
        method: init.method ?? "GET",
        ...(init.body !== undefined && { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) })
      });

    const addMember = async (role: "member" | "viewer") => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: user.id, role: "member" });

      return user;
    };

    return { team, project, owner, outsider, request, anonymous, addMember };
  }
});
