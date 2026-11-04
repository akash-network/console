import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { app } from "@src/rest-app";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";

type QueueItem = { id: string; organizationName: string | null; lastRepliedAt: string | null; owner: string | null };

describe("Internal hardware requests", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const eventRepository = container.resolve(HardwareRequestEventRepository);

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /internal/hardware-requests", () => {
    it.each([undefined, "wrong-token"])("rejects a caller with the token %j", async token => {
      const response = await request("/internal/hardware-requests", token);

      expect(response.status).toBe(401);
    });

    it("lists the requests of every organization with the organization's name, newest first", async () => {
      const { seed, organization } = await setup();
      const older = await seed({ createdAt: new Date("2026-10-01T00:00:00Z") });
      const newer = await seed({ createdAt: new Date("2026-10-02T00:00:00Z") });

      const items = await listQueue(`gpuModel=${older.gpuModel}`);

      expect(items.map(({ id }) => id)).toEqual([newer.id, older.id]);
      expect(items[0].organizationName).toBe(organization.name);
    });

    it("lists the oldest first and pages through them", async () => {
      const { seed, gpuModel } = await setup();
      const oldest = await seed({ createdAt: new Date("2026-10-01T00:00:00Z") });
      const middle = await seed({ createdAt: new Date("2026-10-02T00:00:00Z") });
      await seed({ createdAt: new Date("2026-10-03T00:00:00Z") });

      expect((await listQueue(`gpuModel=${gpuModel}&order=oldest&limit=1`)).map(({ id }) => id)).toEqual([oldest.id]);
      expect((await listQueue(`gpuModel=${gpuModel}&order=oldest&limit=1&offset=1`)).map(({ id }) => id)).toEqual([middle.id]);
    });

    it.each([
      { filter: "lane=sales", matching: { lane: "sales" as const }, other: { lane: "automated" as const } },
      { filter: "status=sourcing", matching: { status: "sourcing" as const }, other: { status: "submitted" as const } },
      { filter: "owner=Remington", matching: { owner: "Remington" }, other: { owner: "Someone else" } },
      { filter: "unowned=true", matching: { owner: null }, other: { owner: "Remington" } }
    ])("filters on $filter", async ({ filter, matching, other }) => {
      const { seed, gpuModel } = await setup();
      const match = await seed(matching);
      await seed(other);

      expect((await listQueue(`gpuModel=${gpuModel}&${filter}`)).map(({ id }) => id)).toEqual([match.id]);
    });

    it("matches the GPU model in any case", async () => {
      const { seed, gpuModel } = await setup();
      const match = await seed({});

      expect((await listQueue(`gpuModel=${gpuModel.toUpperCase()}`)).map(({ id }) => id)).toEqual([match.id]);
    });

    it("dates the last reply from the latest status change or offer, leaving notes out", async () => {
      const { seed, gpuModel } = await setup();
      const hardwareRequest = await seed({});
      const reply = await eventRepository.record({
        hardwareRequestId: hardwareRequest.id,
        type: "status_changed",
        actor: "Remington",
        payload: { from: "submitted", to: "in_review" }
      });
      await eventRepository.record({ hardwareRequestId: hardwareRequest.id, type: "note", actor: "Remington", payload: { text: "Called them" } });

      const [item] = await listQueue(`gpuModel=${gpuModel}`);

      expect(item.lastRepliedAt).toBe(reply.createdAt);
    });

    it("refuses an unknown filter value", async () => {
      const response = await request("/internal/hardware-requests?lane=express", internalToken);

      expect(response.status).toBe(400);
    });
  });

  async function listQueue(query: string): Promise<QueueItem[]> {
    const response = await request(`/internal/hardware-requests?${query}`, internalToken);
    expect(response.status).toBe(200);

    return ((await response.json()) as { data: QueueItem[] }).data;
  }

  async function request(path: string, token: string | undefined) {
    return await app.request(path, { headers: token ? { "x-console-internal-token": token } : {} });
  }

  async function setup() {
    const { user, organization } = await seedOrganizationWithOwner();
    const gpuModel = `gpu-${faker.string.alphanumeric(10).toLowerCase()}`;
    const seed = async (overrides: Partial<Parameters<typeof seedHardwareRequest>[0]>) =>
      await seedHardwareRequest({ userId: user.id, organizationId: organization.id, gpuModel, ...overrides });

    return { seed, organization, gpuModel };
  }
});
