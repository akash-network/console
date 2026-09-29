import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { JOB_NAME } from "@src/core";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

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
      const { data } = (await response.json()) as { data: { id: string; createdAt: string } };

      expect(response.status).toBe(201);
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
        createdAt: data.createdAt
      });
      expect(await findJobRows(HardwareRequestEmailJob[JOB_NAME], { data: { hardwareRequestId: data.id } })).toHaveLength(1);
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

  async function post(token: string | undefined, data: Record<string, unknown>) {
    return await app.request("/v1/hardware-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ data })
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid(), username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() });
    const token = faker.string.alphanumeric(40);

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => (header.replace(/^Bearer +/i, "") === token ? user.userId! : null));

    return { user, token };
  }
});
