import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, describe, expect, it } from "vitest";

import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { app } from "@src/rest-app";

import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";

type QueueItem = { id: string; organizationName: string | null; lastRepliedAt: string | null; owner: string | null };

describe("Internal hardware requests", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const eventRepository = container.resolve(HardwareRequestEventRepository);
  const hardwareRequestRepository = container.resolve(HardwareRequestRepository);

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

  describe("GET /internal/hardware-requests/{id}", () => {
    it("returns the request with its events, oldest first", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ owner: "Remington" });
      const first = await eventRepository.record({ hardwareRequestId: hardwareRequest.id, type: "note", actor: "Remington", payload: { text: "First" } });
      const second = await eventRepository.record({
        hardwareRequestId: hardwareRequest.id,
        type: "owner_changed",
        actor: "Remington",
        payload: { from: null, to: "Remington" }
      });

      const response = await request(`/internal/hardware-requests/${hardwareRequest.id}`, internalToken);
      const { data } = (await response.json()) as { data: QueueItem & { events: Array<{ id: string; type: string; payload: unknown }> } };

      expect(response.status).toBe(200);
      expect(data).toMatchObject({ id: hardwareRequest.id, owner: "Remington", lastRepliedAt: null });
      expect(data.events).toEqual([
        { ...first, payload: { text: "First" } },
        { ...second, payload: { from: null, to: "Remington" } }
      ]);
    });

    it("answers 404 for an unknown request", async () => {
      const response = await request(`/internal/hardware-requests/${faker.string.uuid()}`, internalToken);

      expect(response.status).toBe(404);
    });

    it("rejects a caller without the token", async () => {
      const response = await request(`/internal/hardware-requests/${faker.string.uuid()}`, undefined);

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /internal/hardware-requests/{id}/owner", () => {
    it("claims a request and records who did", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ owner: null });

      const { status, data } = await act(hardwareRequest.id, "owner", { actor: "Remington", owner: "Remington" });

      expect(status).toBe(200);
      expect(data).toMatchObject({ owner: "Remington" });
      expect(data.events).toMatchObject([{ type: "owner_changed", actor: "Remington", payload: { from: null, to: "Remington" } }]);
      expect(await hardwareRequestRepository.findById(hardwareRequest.id)).toMatchObject({ owner: "Remington" });
    });

    it("releases a request", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ owner: "Remington" });

      const { data } = await act(hardwareRequest.id, "owner", { actor: "Remington", owner: null });

      expect(data.owner).toBeNull();
    });

    it("answers 404 for an unknown request", async () => {
      const { status } = await act(faker.string.uuid(), "owner", { actor: "Remington", owner: "Remington" });

      expect(status).toBe(404);
    });

    it("refuses a change without an actor", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});

      const { status } = await act(hardwareRequest.id, "owner", { actor: " ", owner: "Remington" });

      expect(status).toBe(400);
    });

    it("rejects a caller without the token", async () => {
      const response = await app.request(`/internal/hardware-requests/${faker.string.uuid()}/owner`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { actor: "Remington", owner: "Remington" } })
      });

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /internal/hardware-requests/{id}/lane", () => {
    it("moves a request to the sales lane by hand", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ lane: "automated", laneReason: "below_thresholds" });

      const { data } = await act(hardwareRequest.id, "lane", { actor: "Remington", lane: "sales" });

      expect(data).toMatchObject({ lane: "sales", laneReason: "manual" });
      expect(data.events).toMatchObject([{ type: "lane_changed", payload: { from: "automated", to: "sales" } }]);
    });
  });

  describe("POST /internal/hardware-requests/{id}/notes", () => {
    it("adds a note to the timeline without counting it as a reply", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});

      const { data } = await act(hardwareRequest.id, "notes", { actor: "Remington", text: "Called them, wants InfiniBand" });

      expect(data).toMatchObject({ lastRepliedAt: null, firstRepliedAt: null });
      expect(data.events).toMatchObject([{ type: "note", actor: "Remington", payload: { text: "Called them, wants InfiniBand" } }]);
    });
  });

  async function act(id: string, action: string, body: Record<string, unknown>) {
    const response = await app.request(`/internal/hardware-requests/${id}/${action}`, {
      method: action === "notes" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json", "x-console-internal-token": internalToken! },
      body: JSON.stringify({ data: body })
    });
    const json = response.status === 200 ? ((await response.json()) as { data: QueueItem & { events: unknown[]; [key: string]: unknown } }) : undefined;

    return { status: response.status, data: json?.data as QueueItem & { events: unknown[]; [key: string]: unknown } };
  }

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
