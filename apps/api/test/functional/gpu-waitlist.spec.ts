import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { app } from "@src/rest-app";

import { seedGpuWaitlistEntry } from "@test/seeders/db/gpu-waitlist-entry.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedPersonalOrganizationIdOf, seedUser } from "@test/seeders/db/user-with-wallet.seeder";

type Entry = { id: string; placeInLine: number; gpuCount: number; status: string; model: string };

function aPool() {
  return { vendor: "nvidia", model: `H100-${faker.string.alphanumeric(10)}`, gpuCount: 8, source: "no_bids" };
}

describe("GPU waitlist", () => {
  const userAuthTokenService = container.resolve(UserAuthTokenService);
  const featureFlagsService = container.resolve(FeatureFlagsService);
  const entryRepository = container.resolve(GpuWaitlistEntryRepository);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("POST /v1/gpu-waitlist", () => {
    it("returns 401 when the user is not authenticated", async () => {
      const pool = aPool();
      setup({ flagOn: true });

      const response = await join(undefined, pool);

      expect(response.status).toBe(401);
    });

    it("answers like an unknown path while the flag is off", async () => {
      const pool = aPool();
      const { alice } = await setup({ flagOn: false });

      const response = await join(alice.headers, pool);

      expect(response.status).toBe(404);
    });

    it("puts the first user at place 1 and the next user in the same pool at place 2", async () => {
      const pool = aPool();
      const { alice, bob } = await setup();

      const first = await join(alice.headers, pool);
      const second = await join(bob.headers, { ...pool, model: pool.model.toLowerCase() });

      expect(first.status).toBe(200);
      expect(((await first.json()) as { data: Entry }).data).toMatchObject({ placeInLine: 1, status: "waiting", gpuCount: 8 });
      expect(((await second.json()) as { data: Entry }).data.placeInLine).toBe(2);
    });

    it("updates the gpu count and keeps the place when the same pool is joined again", async () => {
      const pool = aPool();
      const { alice, bob } = await setup();
      await join(alice.headers, pool);
      await join(bob.headers, pool);

      const response = await join(alice.headers, { ...pool, gpuCount: 2 });
      const { data } = (await response.json()) as { data: Entry };

      expect(data).toMatchObject({ placeInLine: 1, gpuCount: 2 });
      expect(await entryRepository.countWaitingFor(alice.user.id)).toBe(1);
    });

    it("creates one entry when the same pool is joined twice at once", async () => {
      const pool = aPool();
      const { alice } = await setup();

      const responses = await Promise.all([join(alice.headers, pool), join(alice.headers, pool)]);

      expect(responses.map(response => response.status)).toEqual([200, 200]);
      expect(await entryRepository.countWaitingFor(alice.user.id)).toBe(1);
    });

    it.each([
      { case: "a non-nvidia vendor", override: { vendor: "amd" } },
      { case: "zero GPUs", override: { gpuCount: 0 } },
      { case: "more than 64 GPUs", override: { gpuCount: 65 } },
      { case: "an unknown source", override: { source: "email" } },
      { case: "a blank model", override: { model: "  " } }
    ])("rejects $case", async ({ override }) => {
      const { alice } = await setup();

      const response = await join(alice.headers, { ...aPool(), ...override });

      expect(response.status).toBe(400);
      expect(await entryRepository.countWaitingFor(alice.user.id)).toBe(0);
    });

    it("refuses an 11th active entry with 409", async () => {
      const pool = aPool();
      const { alice } = await setup();
      for (let index = 0; index < 10; index++) {
        await seedGpuWaitlistEntry({
          userId: alice.user.id,
          organizationId: alice.organizationId,
          model: `model-${index}`,
          joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        });
      }

      const response = await join(alice.headers, pool);
      const body = (await response.json()) as { code: string };

      expect(response.status).toBe(409);
      expect(body.code).toBe("gpu_waitlist_active_limit");
    });

    it("refuses an 11th join within an hour and says when to retry", async () => {
      const pool = aPool();
      const { alice } = await setup();
      for (let index = 0; index < 10; index++) {
        await seedGpuWaitlistEntry({ userId: alice.user.id, organizationId: alice.organizationId, model: `model-${index}`, status: "left" });
      }

      const response = await join(alice.headers, pool);
      const body = (await response.json()) as { code: string };

      expect(response.status).toBe(429);
      expect(body.code).toBe("gpu_waitlist_join_limit");
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    });
  });

  describe("in an organization", () => {
    it("gives each member their own place in line for the same pool", async () => {
      const pool = aPool();
      const { alice, bob } = await setupTeam();

      const first = await join(alice.headers, pool);
      const second = await join(bob.headers, pool);

      expect(((await first.json()) as { data: Entry }).data.placeInLine).toBe(1);
      expect(((await second.json()) as { data: Entry }).data.placeInLine).toBe(2);
      expect(await entryRepository.countWaitingFor(alice.user.id)).toBe(1);
      expect(await entryRepository.countWaitingFor(bob.user.id)).toBe(1);
    });
  });

  describe("GET /v1/gpu-waitlist", () => {
    it("lists only the caller's waiting entries, newest first", async () => {
      const { alice, bob } = await setup();
      const older = await seedGpuWaitlistEntry({
        userId: alice.user.id,
        organizationId: alice.organizationId,
        model: "a100",
        joinedAt: new Date(Date.now() - 3 * 60 * 60 * 1000)
      });
      const newer = await seedGpuWaitlistEntry({
        userId: alice.user.id,
        organizationId: alice.organizationId,
        model: "h100",
        joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      });
      await seedGpuWaitlistEntry({ userId: alice.user.id, organizationId: alice.organizationId, model: "l40", status: "left" });
      await seedGpuWaitlistEntry({ userId: bob.user.id, organizationId: bob.organizationId, model: "h200" });

      const response = await list(alice.headers);
      const { data } = (await response.json()) as { data: Entry[] };

      expect(response.status).toBe(200);
      expect(data.map(entry => entry.id)).toEqual([newer.id, older.id]);
    });

    it("answers like an unknown path while the flag is off", async () => {
      const { alice } = await setup({ flagOn: false });

      const response = await list(alice.headers);

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /v1/gpu-waitlist/{id}", () => {
    it("removes the entry from the list and moves the next user up", async () => {
      const pool = aPool();
      const { alice, bob } = await setup();
      const { data: aliceEntry } = (await (await join(alice.headers, pool)).json()) as { data: Entry };
      await join(bob.headers, pool);

      const response = await leave(alice.headers, aliceEntry.id);

      expect(response.status).toBe(204);
      expect(((await (await list(alice.headers)).json()) as { data: Entry[] }).data).toEqual([]);
      expect(((await (await list(bob.headers)).json()) as { data: Entry[] }).data).toMatchObject([{ placeInLine: 1 }]);
    });

    it("answers 404 for another user's entry and leaves it waiting", async () => {
      const { alice, bob } = await setup();
      const entry = await seedGpuWaitlistEntry({ userId: bob.user.id, organizationId: bob.organizationId });

      const response = await leave(alice.headers, entry.id);

      expect(response.status).toBe(404);
      expect(await entryRepository.countWaitingFor(bob.user.id)).toBe(1);
    });

    it("answers 404 for an entry that was already left", async () => {
      const { alice } = await setup();
      const entry = await seedGpuWaitlistEntry({ userId: alice.user.id, organizationId: alice.organizationId, status: "left" });

      const response = await leave(alice.headers, entry.id);

      expect(response.status).toBe(404);
    });
  });

  async function join(headers: Record<string, string> | undefined, data: Record<string, unknown>) {
    return await app.request("/v1/gpu-waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ data })
    });
  }

  async function list(headers: Record<string, string>) {
    return await app.request("/v1/gpu-waitlist", { headers });
  }

  async function leave(headers: Record<string, string>, id: string) {
    return await app.request(`/v1/gpu-waitlist/${id}`, { method: "DELETE", headers });
  }

  function authenticate(users: { userId: string | null }[]) {
    const tokens = new Map(users.map(user => [`token-${user.userId}`, user.userId!]));
    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null);

    return (user: { userId: string | null }, extra: Record<string, string> = {}) => ({ authorization: `Bearer token-${user.userId}`, ...extra });
  }

  function enableFlag(flagOn: boolean) {
    vi.spyOn(featureFlagsService, "isEnabled").mockImplementation(flag => flagOn || flag !== FeatureFlags.GPU_AVAILABILITY_ALERTS);
  }

  async function setup(input: { flagOn?: boolean } = {}) {
    enableFlag(input.flagOn ?? true);
    const alice = await seedUser({ userId: faker.string.uuid() });
    const bob = await seedUser({ userId: faker.string.uuid() });
    const headersOf = authenticate([alice, bob]);

    const [aliceOrganizationId, bobOrganizationId] = [await seedPersonalOrganizationIdOf(alice.id), await seedPersonalOrganizationIdOf(bob.id)];

    return {
      alice: { user: alice, organizationId: aliceOrganizationId, headers: headersOf(alice) },
      bob: { user: bob, organizationId: bobOrganizationId, headers: headersOf(bob) }
    };
  }

  async function setupTeam() {
    enableFlag(true);
    const { user: owner, organization } = await seedOrganizationWithOwner({ user: { userId: faker.string.uuid() } });
    const member = await seedUser({ userId: faker.string.uuid() });
    await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const headersOf = authenticate([owner, member]);
    const inOrganization = { "x-organization-id": organization.id };

    return {
      alice: { user: owner, headers: headersOf(owner, inOrganization) },
      bob: { user: member, headers: headersOf(member, inOrganization) }
    };
  }
});
