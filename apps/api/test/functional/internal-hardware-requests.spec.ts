import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { JOB_NAME } from "@src/core";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestEmailJob } from "@src/hardware-request/services/hardware-request-email/hardware-request-email.handler";
import { HardwareRequestSlackAlertJob } from "@src/hardware-request/services/hardware-request-slack-alert/hardware-request-slack-alert.handler";
import { HardwareRequestStatusNotificationJob } from "@src/hardware-request/services/hardware-request-status-notification/hardware-request-status-notification.handler";
import { app, initDb } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

import { createAkashAddress, createProvider } from "@test/seeders";
import { seedHardwareRequest } from "@test/seeders/db/hardware-request.seeder";
import { seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

type QueueItem = { id: string; organizationName: string | null; lastRepliedAt: string | null; owner: string | null };

describe("Internal hardware requests", () => {
  const internalToken = container.resolve(CORE_CONFIG).INTERNAL_API_TOKEN;
  const eventRepository = container.resolve(HardwareRequestEventRepository);
  const hardwareRequestRepository = container.resolve(HardwareRequestRepository);

  beforeAll(async () => {
    await initDb();
    await startJobQueues();
  }, 20_000);

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
      { filter: "unowned=true", matching: { owner: null }, other: { owner: "Remington" } },
      {
        filter: "responseTarget=missed",
        matching: { firstReplyDueAt: new Date(Date.now() - 60_000) },
        other: { firstReplyDueAt: new Date(Date.now() + 3_600_000) }
      }
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

  describe("POST /internal/hardware-requests", () => {
    it("files a request for the organization's owner, routes it and alerts the team", async () => {
      const { user, organization } = await seedOrganizationWithOwner();

      const { status, data } = await createOnBehalf({
        actor: "Remington",
        organizationId: organization.id,
        request: { category: "gpu_model", gpuModel: "B200", quantity: 8, email: "jane@example.com" }
      });

      expect(status).toBe(201);
      expect(data).toMatchObject({
        userId: user.id,
        organizationId: organization.id,
        organizationName: organization.name,
        gpuModel: "B200",
        contactEmail: "jane@example.com",
        lane: "automated",
        laneReason: "no_payment_method",
        estimatedMonthlyUsd: 8 * 5 * 730
      });
      expect(data.events).toMatchObject([{ type: "created_on_behalf", actor: "Remington", payload: { organizationId: organization.id, email: null } }]);
      expect(await findJobRows(HardwareRequestEmailJob[JOB_NAME], { data: { hardwareRequestId: data.id } })).toHaveLength(1);
      expect(await findJobRows(HardwareRequestSlackAlertJob[JOB_NAME], { data: { hardwareRequestId: data.id } })).toHaveLength(1);
    });

    it("files a request for a contact email with no account yet", async () => {
      const email = faker.internet.email().toLowerCase();

      const { status, data } = await createOnBehalf({ actor: "Remington", request: { category: "gpu_model", gpuModel: "B200", quantity: 8, email } });

      expect(status).toBe(201);
      expect(data).toMatchObject({ userId: null, organizationId: null, organizationName: null, contactEmail: email, lane: "automated" });
      expect(data.events).toMatchObject([{ type: "created_on_behalf", payload: { organizationId: null, email } }]);
    });

    it("refuses a contact email a verified account already uses", async () => {
      const email = faker.internet.email().toLowerCase();
      await container.resolve(UserRepository).create({ userId: faker.string.uuid(), email, emailVerified: true });

      const { status } = await createOnBehalf({ actor: "Remington", request: { category: "other", details: "ARM", email: email.toUpperCase() } });

      expect(status).toBe(409);
    });

    it("answers 404 for an unknown organization", async () => {
      const { status } = await createOnBehalf({
        actor: "Remington",
        organizationId: faker.string.uuid(),
        request: { category: "other", details: "ARM", email: "jane@example.com" }
      });

      expect(status).toBe(404);
    });

    it("refuses an invalid request", async () => {
      const { organization } = await seedOrganizationWithOwner();

      const { status } = await createOnBehalf({
        actor: "Remington",
        organizationId: organization.id,
        request: { category: "quote", email: "jane@example.com" }
      });

      expect(status).toBe(400);
    });

    it("rejects a caller without the token", async () => {
      const response = await app.request("/internal/hardware-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { actor: "Remington", organizationId: faker.string.uuid(), request: { category: "other", details: "ARM", email: "jane@example.com" } }
        })
      });

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

    it("refuses an owner longer than the request's owner column holds", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ owner: null });

      const { status } = await act(hardwareRequest.id, "owner", { actor: "Remington", owner: "R".repeat(65) });

      expect(status).toBe(400);
      expect(await hardwareRequestRepository.findById(hardwareRequest.id)).toMatchObject({ owner: null });
    });

    it("takes an owner as long as the request's owner column holds", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ owner: null });

      const { status } = await act(hardwareRequest.id, "owner", { actor: "Remington", owner: "R".repeat(64) });

      expect(status).toBe(200);
      expect(await hardwareRequestRepository.findById(hardwareRequest.id)).toMatchObject({ owner: "R".repeat(64) });
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

  describe("PUT /internal/hardware-requests/{id}/status", () => {
    it("moves the request, dates its first reply and queues the tenant's notification", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "submitted" });

      const { status, data } = await act(hardwareRequest.id, "status", { actor: "Remington", status: "sourcing" });

      expect(status).toBe(200);
      expect(data).toMatchObject({ status: "sourcing", firstRepliedAt: expect.any(String), lastRepliedAt: expect.any(String) });
      expect(data.events).toMatchObject([{ type: "status_changed", actor: "Remington", payload: { from: "submitted", to: "sourcing" } }]);
      expect(await findJobRows(HardwareRequestStatusNotificationJob[JOB_NAME], { data: { hardwareRequestId: hardwareRequest.id } })).toMatchObject([
        { data: { status: "sourcing" } }
      ]);
    });

    it("closes a request with its reason", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });

      const { data } = await act(hardwareRequest.id, "status", { actor: "Remington", status: "closed", closeReason: "went_silent" });

      expect(data.events).toMatchObject([{ payload: { from: "sourcing", to: "closed", closeReason: "went_silent" } }]);
    });

    it.each([
      { case: "a close without a reason", body: { actor: "Remington", status: "closed" } },
      { case: "a reason on a status other than closed", body: { actor: "Remington", status: "sourcing", closeReason: "price" } },
      { case: "an unknown reason", body: { actor: "Remington", status: "closed", closeReason: "bored" } }
    ])("refuses $case", async ({ body }) => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });

      const { status } = await act(hardwareRequest.id, "status", body);

      expect(status).toBe(400);
      expect(await hardwareRequestRepository.findById(hardwareRequest.id)).toMatchObject({ status: "sourcing" });
    });
  });

  describe("POST /internal/hardware-requests/{id}/offers", () => {
    it("drafts an offer with the provider's audit and uptime, and lists it on the request", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});
      const provider = await createProvider({ uptime7d: 0.97 });

      const { status, data } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers`, anOffer(provider.owner));

      expect(status).toBe(201);
      expect(data).toMatchObject({
        hardwareRequestId: hardwareRequest.id,
        status: "draft",
        providerAddress: provider.owner,
        providerAudited: true,
        providerUptime7d: 0.97,
        usdPerGpuHour: 2.4,
        terms: anOffer(provider.owner).terms,
        publishedAt: null
      });
      const response = await request(`/internal/hardware-requests/${hardwareRequest.id}`, internalToken);
      expect(((await response.json()) as { data: { offers: unknown[] } }).data.offers).toMatchObject([{ id: data.id }]);
    });

    it("answers 422 for an address no provider has", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});

      const { status } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers`, anOffer(createAkashAddress()));

      expect(status).toBe(422);
    });

    it("refuses an offer that has already expired", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});
      const provider = await createProvider();

      const { status } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers`, {
        ...anOffer(provider.owner),
        expiresAt: new Date(Date.now() - 60_000).toISOString()
      });

      expect(status).toBe(400);
    });

    it("answers 404 for an unknown request", async () => {
      const provider = await createProvider();

      const { status } = await offerRequest("POST", `/internal/hardware-requests/${faker.string.uuid()}/offers`, anOffer(provider.owner));

      expect(status).toBe(404);
    });
  });

  describe("PUT /internal/hardware-requests/{id}/offers/{offerId}", () => {
    it("edits an open offer", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});
      const provider = await createProvider();
      const created = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers`, anOffer(provider.owner));

      const { status, data } = await offerRequest("PUT", `/internal/hardware-requests/${hardwareRequest.id}/offers/${created.data.id}`, {
        ...anOffer(provider.owner),
        usdPerGpuHour: 2.1
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ id: created.data.id, usdPerGpuHour: 2.1 });
    });

    it("answers 409 for an offer that is no longer open", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});
      const provider = await createProvider();
      const created = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers`, anOffer(provider.owner));
      await container.resolve(HardwareRequestOfferRepository).updateById(created.data.id, { status: "withdrawn" });

      const { status } = await offerRequest("PUT", `/internal/hardware-requests/${hardwareRequest.id}/offers/${created.data.id}`, anOffer(provider.owner));

      expect(status).toBe(409);
    });
  });

  describe("POST /internal/hardware-requests/{id}/offers/{offerId}/publish", () => {
    it("shows the first offer to the tenant and moves the request to offers, which tells them", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });
      const { data: offer } = await draftOffer(hardwareRequest.id);

      const { status, data } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${offer.id}/publish`, {
        actor: "Remington"
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ id: offer.id, status: "published", publishedAt: expect.any(String) });
      const request = await getRequest(hardwareRequest.id);
      expect(request).toMatchObject({ status: "offers", firstRepliedAt: expect.any(String) });
      expect(request.events).toMatchObject([
        { type: "offer_published", actor: "Remington", payload: { offerId: offer.id } },
        { type: "status_changed", payload: { from: "sourcing", to: "offers" } }
      ]);
      expect(await findJobRows(HardwareRequestStatusNotificationJob[JOB_NAME], { data: { hardwareRequestId: hardwareRequest.id } })).toMatchObject([
        { data: { status: "offers" } }
      ]);
    });

    it("tells the tenant only once when more offers follow", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });
      const [{ data: first }, { data: second }] = [await draftOffer(hardwareRequest.id), await draftOffer(hardwareRequest.id)];
      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${first.id}/publish`, { actor: "Remington" });

      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${second.id}/publish`, { actor: "Remington" });

      expect(await findJobRows(HardwareRequestStatusNotificationJob[JOB_NAME], { data: { hardwareRequestId: hardwareRequest.id } })).toHaveLength(1);
    });

    it("refuses an offer that expired before it was published", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });
      const { data: offer } = await draftOffer(hardwareRequest.id);
      await container.resolve(HardwareRequestOfferRepository).updateById(offer.id, { expiresAt: new Date(Date.now() - 60_000) });

      const { status } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${offer.id}/publish`, { actor: "Remington" });

      expect(status).toBe(409);
      expect(await getRequest(hardwareRequest.id)).toMatchObject({ status: "sourcing" });
    });
  });

  describe("POST /internal/hardware-requests/{id}/offers/{offerId}/withdraw", () => {
    it("withdraws an offer and records who did", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({});
      const { data: offer } = await draftOffer(hardwareRequest.id);

      const { status, data } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${offer.id}/withdraw`, {
        actor: "Remington"
      });

      expect(status).toBe(200);
      expect(data).toMatchObject({ id: offer.id, status: "withdrawn" });
      expect((await getRequest(hardwareRequest.id)).events).toMatchObject([{ type: "offer_withdrawn", actor: "Remington", payload: { offerId: offer.id } }]);
    });

    it("takes the request back to sourcing when its only published offer is withdrawn", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });
      const { data: offer } = await draftOffer(hardwareRequest.id);
      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${offer.id}/publish`, { actor: "Remington" });

      const { status } = await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${offer.id}/withdraw`, { actor: "Remington" });

      expect(status).toBe(200);
      const withdrawnRequest = await getRequest(hardwareRequest.id);
      expect(withdrawnRequest).toMatchObject({ status: "sourcing" });
      expect(withdrawnRequest.events).toContainEqual(
        expect.objectContaining({ type: "status_changed", actor: "Remington", payload: { from: "offers", to: "sourcing" } })
      );
    });

    it("keeps the request with offers while another published offer is left", async () => {
      const { seed } = await setup();
      const hardwareRequest = await seed({ status: "sourcing" });
      const { data: first } = await draftOffer(hardwareRequest.id);
      const { data: second } = await draftOffer(hardwareRequest.id);
      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${first.id}/publish`, { actor: "Remington" });
      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${second.id}/publish`, { actor: "Remington" });

      await offerRequest("POST", `/internal/hardware-requests/${hardwareRequest.id}/offers/${first.id}/withdraw`, { actor: "Remington" });

      expect(await getRequest(hardwareRequest.id)).toMatchObject({ status: "offers" });
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

  async function createOnBehalf(body: Record<string, unknown>) {
    const response = await app.request("/internal/hardware-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-console-internal-token": internalToken! },
      body: JSON.stringify({ data: body })
    });
    const json = response.status === 201 ? ((await response.json()) as { data: QueueItem & { events: unknown[]; [key: string]: unknown } }) : undefined;

    return { status: response.status, data: json?.data as QueueItem & { events: unknown[]; [key: string]: unknown } };
  }

  function anOffer(providerAddress: string) {
    return {
      providerAddress,
      usdPerGpuHour: 2.4,
      terms: {
        gpu: { model: "H200", count: 16, interconnect: "cluster" },
        location: "Frankfurt, DE",
        availableFrom: "2026-12-01",
        term: "6_months",
        sla: "99.9",
        storage: { tbPerNode: 8, nvme: true },
        uplinkGbps: 10
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  async function offerRequest(method: "POST" | "PUT", path: string, body: Record<string, unknown>) {
    const response = await app.request(path, {
      method,
      headers: { "Content-Type": "application/json", "x-console-internal-token": internalToken! },
      body: JSON.stringify({ data: body })
    });
    const json = response.ok ? ((await response.json()) as { data: { id: string; [key: string]: unknown } }) : undefined;

    return { status: response.status, data: json?.data as { id: string; [key: string]: unknown } };
  }

  async function draftOffer(hardwareRequestId: string) {
    const provider = await createProvider();

    return await offerRequest("POST", `/internal/hardware-requests/${hardwareRequestId}/offers`, anOffer(provider.owner));
  }

  async function getRequest(id: string) {
    const response = await request(`/internal/hardware-requests/${id}`, internalToken);

    return ((await response.json()) as { data: QueueItem & { status: string; firstRepliedAt: string | null; events: unknown[] } }).data;
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
