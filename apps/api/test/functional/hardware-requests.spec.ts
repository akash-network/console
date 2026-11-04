import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { HardwareRequestSlackAlertJob } from "@src/hardware-request/services/hardware-request-slack-alert/hardware-request-slack-alert.handler";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

const CONFIGURATION = {
  summary: "1 vCPU · 2 GB memory · 0 MB storage · Any region",
  cpu: 1,
  memoryBytes: 2_000_000_000,
  storageBytes: 0,
  region: null
};

describe("Hardware requests", () => {
  const userRepository = container.resolve(UserRepository);
  const hardwareRequestRepository = container.resolve(HardwareRequestRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/hardware-requests", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const response = await post(undefined, { category: "gpu_model", gpuModel: "B200", quantity: 8, email: "jane@example.com" });

      expect(response.status).toBe(401);
    });

    it("records the request with its configuration and queues the email for it", async () => {
      const { user, token } = await setup();

      const response = await post(token, {
        category: "gpu_model",
        gpuModel: "B200",
        quantity: 8,
        details: "Training run for 3 months",
        email: "jane@example.com",
        configuration: CONFIGURATION
      });
      const { data } = (await response.json()) as { data: { id: string; createdAt: string; lane: string } };

      expect(response.status).toBe(201);
      expect(data.lane).toBe("automated");
      expect(await hardwareRequestRepository.findById(data.id)).toEqual({
        id: data.id,
        userId: user.id,
        category: "gpu_model",
        gpuModel: "B200",
        quantity: 8,
        region: null,
        details: "Training run for 3 months",
        contactEmail: "jane@example.com",
        configuration: CONFIGURATION,
        organizationId: expect.any(String),
        status: "submitted",
        source: null,
        spec: null,
        lane: "automated",
        laneReason: "no_payment_method",
        estimatedMonthlyUsd: 8 * 5 * 730,
        owner: null,
        firstRepliedAt: null,
        createdAt: data.createdAt,
        updatedAt: data.createdAt
      });
      expect(await findJobRows(HardwareRequestEmailJob[JOB_NAME], { data: { hardwareRequestId: data.id } })).toHaveLength(1);
      expect(await findJobRows(HardwareRequestSlackAlertJob[JOB_NAME], { data: { hardwareRequestId: data.id } })).toHaveLength(1);
    });

    it("records a region request without any GPU fields", async () => {
      const { token } = await setup();

      const response = await post(token, { category: "region", region: "Frankfurt", email: "jane@example.com" });
      const { data } = (await response.json()) as { data: { id: string } };

      expect(response.status).toBe(201);
      expect(await hardwareRequestRepository.findById(data.id)).toMatchObject({ category: "region", region: "Frankfurt", gpuModel: null, quantity: null });
    });

    it.each([
      { case: "a GPU request without a model", body: { category: "gpu_model", quantity: 8, email: "jane@example.com" } },
      { case: "a GPU request for zero GPUs", body: { category: "gpu_model", gpuModel: "B200", quantity: 0, email: "jane@example.com" } },
      { case: "a region request without a region", body: { category: "region", region: "  ", email: "jane@example.com" } },
      { case: "an other request without details", body: { category: "other", email: "jane@example.com" } },
      { case: "an invalid contact email", body: { category: "other", details: "Need ARM nodes", email: "not-an-email" } },
      { case: "an unknown category", body: { category: "storage", email: "jane@example.com" } }
    ])("rejects $case", async ({ body }) => {
      const { user, token } = await setup();

      const response = await post(token, body);

      expect(response.status).toBe(400);
      expect(await hardwareRequestRepository.count({ userId: user.id })).toBe(0);
    });

    it("refuses a fourth request within an hour and says when to retry", async () => {
      const { user, token } = await setup();
      await seedRequests(user.id, 3);

      const response = await post(token, { category: "other", details: "Need ARM nodes", email: "jane@example.com" });
      const body = (await response.json()) as { code: string; message: string };

      expect(response.status).toBe(429);
      expect(body.code).toBe("hardware_request_limit");
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await hardwareRequestRepository.count({ userId: user.id })).toBe(3);
    });

    it("counts only the user's own requests against their limit", async () => {
      const { token } = await setup();
      const otherUser = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}` });
      await seedRequests(otherUser.id, 3);

      const response = await post(token, { category: "other", details: "Need ARM nodes", email: "jane@example.com" });

      expect(response.status).toBe(201);
    });
  });

  async function seedRequests(userId: string, count: number) {
    for (let index = 0; index < count; index++) {
      await hardwareRequestRepository.create({ userId, category: "other", details: "Seeded request", contactEmail: "jane@example.com" });
    }
  }

  describe("in an organization", () => {
    it("records a quote request under the active organization with its spec and source", async () => {
      const { team, headersOf } = await setupOrganization();
      const spec = createHardwareRequestSpec();

      const response = await app.request("/v1/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersOf(team.owner) },
        body: JSON.stringify({ data: { category: "quote", spec, source: "reserve_capacity", email: "jane@example.com" } })
      });
      const { data } = (await response.json()) as { data: { id: string } };

      expect(response.status).toBe(201);
      expect(await hardwareRequestRepository.findById(data.id)).toMatchObject({
        organizationId: team.id,
        userId: team.owner.id,
        category: "quote",
        status: "submitted",
        source: "reserve_capacity",
        spec,
        gpuModel: "H200",
        quantity: 16,
        region: "United States, Canada"
      });
    });

    it("sends a large quote request of a team with a card on file to the sales lane and says so", async () => {
      const { team, headersOf } = await setupOrganization();
      await seedPaymentMethod({ userId: team.owner.id, organizationId: team.id });
      const spec = createHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" }, targetPrice: { maxUsdPerGpuHour: 3 } });

      const response = await app.request("/v1/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersOf(team.owner) },
        body: JSON.stringify({ data: { category: "quote", spec, email: "jane@example.com" } })
      });
      const { data } = (await response.json()) as { data: { id: string; lane: string } };

      expect(response.status).toBe(201);
      expect(data.lane).toBe("sales");
      expect(await hardwareRequestRepository.findById(data.id)).toMatchObject({
        lane: "sales",
        laneReason: "monthly_value",
        estimatedMonthlyUsd: 16 * 3 * 730,
        owner: "Sales"
      });
    });

    it("keeps the same request of a team without a card in the automated lane", async () => {
      const { team, headersOf } = await setupOrganization();
      const spec = createHardwareRequestSpec({ gpu: { model: "H200", count: 16, interconnect: "cluster" } });

      const response = await app.request("/v1/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersOf(team.owner) },
        body: JSON.stringify({ data: { category: "quote", spec, email: "jane@example.com" } })
      });
      const { data } = (await response.json()) as { data: { id: string; lane: string } };

      expect(data.lane).toBe("automated");
      expect(await hardwareRequestRepository.findById(data.id)).toMatchObject({ lane: "automated", laneReason: "no_payment_method" });
    });

    it.each([
      { case: "an area-restricted region without any area", region: { mode: "only", areas: [] } },
      { case: "the same area twice", region: { mode: "only", areas: ["uk", "uk"] } },
      { case: "every area excluded", region: { mode: "except", areas: ["us", "ca", "eu", "uk", "apac", "me", "latam"] } }
    ] as const)("refuses a quote request whose spec names $case", async ({ region }) => {
      const { team, headersOf } = await setupOrganization();

      const response = await app.request("/v1/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersOf(team.owner) },
        body: JSON.stringify({
          data: { category: "quote", spec: createHardwareRequestSpec({ region: { mode: region.mode, areas: [...region.areas] } }), email: "jane@example.com" }
        })
      });

      expect(response.status).toBe(400);
    });

    it("stores the longest region an accepted quote request can describe", async () => {
      const { team, headersOf } = await setupOrganization();
      const spec = createHardwareRequestSpec({ region: { mode: "except", areas: ["us", "ca", "eu", "uk", "apac", "latam"] } });

      const response = await app.request("/v1/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headersOf(team.owner) },
        body: JSON.stringify({ data: { category: "quote", spec, email: "jane@example.com" } })
      });

      expect(response.status).toBe(201);
    });

    it("lists the organization's requests newest first to every member, without another organization's", async () => {
      const { team, headersOf, memberWith } = await setupOrganization();
      const member = await memberWith("viewer");
      const older = await seedHardwareRequest({ userId: team.owner.id, organizationId: team.id, createdAt: new Date("2026-10-01T00:00:00Z") });
      const newer = await seedHardwareRequest({ userId: team.owner.id, organizationId: team.id, createdAt: new Date("2026-10-02T00:00:00Z") });
      const other = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
      await seedHardwareRequest({ userId: other.user.id, organizationId: other.organization.id });

      const response = await app.request("/v1/hardware-requests", { headers: headersOf(member) });
      const { data } = (await response.json()) as { data: Array<{ id: string; status: string; configuration?: unknown }> };

      expect(response.status).toBe(200);
      expect(data.map(({ id }) => id)).toEqual([newer.id, older.id]);
      expect(data[0]).toMatchObject({ status: "submitted", organizationId: team.id });
      expect(data[0]).not.toHaveProperty("configuration");
      expect(data[0]).not.toHaveProperty("laneReason");
      expect(data[0]).not.toHaveProperty("estimatedMonthlyUsd");
      expect(data[0]).not.toHaveProperty("owner");
    });

    it("returns 401 to an anonymous caller", async () => {
      const response = await app.request("/v1/hardware-requests");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /v1/hardware-requests/{id}/offers", () => {
    it("shows every member the published offers of the organization's request, without the provider", async () => {
      const { team, headersOf, memberWith } = await setupOrganization();
      const member = await memberWith("viewer");
      const hardwareRequest = await seedHardwareRequest({ userId: team.owner.id, organizationId: team.id });
      const offers = container.resolve(HardwareRequestOfferRepository);
      const published = await offers.create({ ...anOffer(hardwareRequest.id), status: "published", publishedAt: new Date() });
      await offers.create({ ...anOffer(hardwareRequest.id), status: "draft" });
      await offers.create({ ...anOffer(hardwareRequest.id), status: "withdrawn" });

      const response = await app.request(`/v1/hardware-requests/${hardwareRequest.id}/offers`, { headers: headersOf(member) });
      const { data } = (await response.json()) as { data: Array<Record<string, unknown>> };

      expect(response.status).toBe(200);
      expect(data).toEqual([
        {
          id: published.id,
          status: "published",
          expired: false,
          providerAudited: true,
          providerUptime7d: 0.99,
          usdPerGpuHour: 2.4,
          estimatedMonthlyUsd: 28_032,
          terms: anOffer(hardwareRequest.id).terms,
          expiresAt: published.expiresAt,
          publishedAt: published.publishedAt
        }
      ]);
    });

    it("answers 404 for another organization's request", async () => {
      const { headersOf, team } = await setupOrganization();
      const other = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
      const hardwareRequest = await seedHardwareRequest({ userId: other.user.id, organizationId: other.organization.id });

      const response = await app.request(`/v1/hardware-requests/${hardwareRequest.id}/offers`, { headers: headersOf(team.owner) });

      expect(response.status).toBe(404);
    });
  });

  function anOffer(hardwareRequestId: string) {
    return {
      hardwareRequestId,
      providerAddress: "akash1provider",
      providerAudited: true,
      providerUptime7d: 0.99,
      usdPerGpuHour: 2.4,
      terms: {
        gpu: { model: "H200", count: 16, interconnect: "cluster" as const },
        location: "Frankfurt, DE",
        availableFrom: "2026-12-01",
        term: "6_months" as const,
        sla: "99.9" as const,
        storage: { tbPerNode: 8, nvme: true },
        uplinkGbps: 10 as const
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };
  }

  async function seedPaymentMethod(owner: { userId: string; organizationId: string }) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("PaymentMethods"))
      .values({ ...owner, fingerprint: `fp_${faker.string.alphanumeric(16)}`, paymentMethodId: `pm_${faker.string.alphanumeric(24)}` });
  }

  async function post(token: string | undefined, data: Record<string, unknown>) {
    return await app.request("/v1/hardware-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ data })
    });
  }

  async function setupOrganization() {
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
    const tokens = new Map<string, string>();
    const tokenByUserId = new Map<string, string>();
    const authenticate = (user: { id: string; userId: string | null }) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);
      tokenByUserId.set(user.id, token);
    };
    authenticate(owner);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async received => tokens.get(received.replace(/^Bearer +/i, "")) ?? null);
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);

    const headersOf = (user: { id: string }) => ({ authorization: `Bearer ${tokenByUserId.get(user.id)}`, "x-organization-id": organization.id });
    const memberWith = async (role: OrganizationRole) => {
      const member = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role });
      authenticate(member);

      return member;
    };

    return { team: { ...organization, owner }, headersOf, memberWith };
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
