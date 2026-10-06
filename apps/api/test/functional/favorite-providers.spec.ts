import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { app } from "@src/rest-app";
import { MAX_FAVORITE_PROVIDERS } from "@src/user/http-schemas/favorite-providers.schema";
import { FavoriteProviderRepository } from "@src/user/repositories/favorite-provider/favorite-provider.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe("Favorite providers", () => {
  const userRepository = container.resolve(UserRepository);
  const favoriteProviderRepository = container.resolve(FavoriteProviderRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/favorite-providers", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("GET", "/v1/favorite-providers");

      expect(response.status).toBe(401);
    });

    it("lists the caller's favorites in the order they were added and nobody else's", async () => {
      const { token, seed } = await setup();
      const stranger = await setup();
      const first = createAkashAddress();
      const second = createAkashAddress();
      await seed(first, new Date("2026-10-05T10:00:00.000Z"));
      await seed(second, new Date("2026-10-05T11:00:00.000Z"));
      await stranger.seed(createAkashAddress());

      const response = await request("GET", "/v1/favorite-providers", token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { providerAddresses: [first, second] } });
    });

    it("lists nothing for a caller with no favorites", async () => {
      const { token } = await setup();

      const response = await request("GET", "/v1/favorite-providers", token);

      expect(await response.json()).toEqual({ data: { providerAddresses: [] } });
    });
  });

  describe("POST /v1/favorite-providers", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("POST", "/v1/favorite-providers", undefined, { providerAddresses: [createAkashAddress()] });

      expect(response.status).toBe(401);
    });

    it("adds the providers after the ones already there and answers with the whole list", async () => {
      const { token, seed } = await setup();
      const existing = createAkashAddress();
      const added = createAkashAddress();
      await seed(existing, new Date("2026-10-05T10:00:00.000Z"));

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: [added] });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { providerAddresses: [existing, added] } });
    });

    it("keeps a provider already a favorite in its place and does not add it twice", async () => {
      const { token, seed } = await setup();
      const existing = createAkashAddress();
      const later = createAkashAddress();
      await seed(existing, new Date("2026-10-05T10:00:00.000Z"));
      await seed(later, new Date("2026-10-05T11:00:00.000Z"));

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: [existing, existing] });

      expect(await response.json()).toEqual({ data: { providerAddresses: [existing, later] } });
    });

    it("leaves another user's favorites alone", async () => {
      const { token } = await setup();
      const stranger = await setup();
      const shared = createAkashAddress();
      await stranger.seed(shared);

      await request("POST", "/v1/favorite-providers", token, { providerAddresses: [shared] });
      const strangerList = await request("GET", "/v1/favorite-providers", stranger.token);

      expect(await strangerList.json()).toEqual({ data: { providerAddresses: [shared] } });
    });

    it("refuses an address that is not an akash account", async () => {
      const { token } = await setup();

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: ["cosmos1notakash"] });

      expect(response.status).toBe(400);
    });

    it("refuses an empty list", async () => {
      const { token } = await setup();

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: [] });

      expect(response.status).toBe(400);
    });

    it("refuses to go past the cap and keeps the favorites as they were", async () => {
      const { token, user } = await setup();
      const kept = Array.from({ length: MAX_FAVORITE_PROVIDERS }, () => createAkashAddress());
      await favoriteProviderRepository.addAll(user.id, kept);

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: [createAkashAddress()] });
      const list = await request("GET", "/v1/favorite-providers", token);

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ message: `You can keep up to ${MAX_FAVORITE_PROVIDERS} favorite providers.` });
      expect(((await list.json()) as { data: { providerAddresses: string[] } }).data.providerAddresses).toHaveLength(MAX_FAVORITE_PROVIDERS);
    });

    it("accepts a provider already a favorite when the user is at the cap", async () => {
      const { token, user } = await setup();
      const kept = Array.from({ length: MAX_FAVORITE_PROVIDERS }, () => createAkashAddress());
      await favoriteProviderRepository.addAll(user.id, kept);

      const response = await request("POST", "/v1/favorite-providers", token, { providerAddresses: [kept[0]] });

      expect(response.status).toBe(200);
    });
  });

  describe("DELETE /v1/favorite-providers/{providerAddress}", () => {
    it("returns 401 when the caller is not authenticated", async () => {
      const response = await request("DELETE", `/v1/favorite-providers/${createAkashAddress()}`);

      expect(response.status).toBe(401);
    });

    it("removes the provider and answers with what is left", async () => {
      const { token, seed } = await setup();
      const removed = createAkashAddress();
      const kept = createAkashAddress();
      await seed(removed, new Date("2026-10-05T10:00:00.000Z"));
      await seed(kept, new Date("2026-10-05T11:00:00.000Z"));

      const response = await request("DELETE", `/v1/favorite-providers/${removed}`, token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { providerAddresses: [kept] } });
    });

    it("answers with the list unchanged for a provider that is not a favorite", async () => {
      const { token, seed } = await setup();
      const kept = createAkashAddress();
      await seed(kept);

      const response = await request("DELETE", `/v1/favorite-providers/${createAkashAddress()}`, token);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { providerAddresses: [kept] } });
    });

    it("leaves the same provider in another user's favorites", async () => {
      const { token, seed } = await setup();
      const stranger = await setup();
      const shared = createAkashAddress();
      await seed(shared);
      await stranger.seed(shared);

      await request("DELETE", `/v1/favorite-providers/${shared}`, token);
      const strangerList = await request("GET", "/v1/favorite-providers", stranger.token);

      expect(await strangerList.json()).toEqual({ data: { providerAddresses: [shared] } });
    });

    it("refuses an address that is not an akash account", async () => {
      const { token } = await setup();

      const response = await request("DELETE", "/v1/favorite-providers/not-an-address", token);

      expect(response.status).toBe(400);
    });
  });

  async function request(method: "GET" | "POST" | "DELETE", path: string, token?: string, data?: Record<string, unknown>) {
    return await app.request(path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify({ data }) } : {})
    });
  }

  async function setup() {
    const user = await userRepository.create({ userId: faker.string.uuid() });
    const token = faker.string.alphanumeric(40);
    const otherTokens = vi.isMockFunction(userAuthTokenService.getValidUserId)
      ? vi.mocked(userAuthTokenService.getValidUserId).getMockImplementation()
      : undefined;

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? user.userId! : (await otherTokens?.(header)) ?? null
    );

    async function seed(providerAddress: string, createdAt?: Date) {
      return await favoriteProviderRepository.create({ userId: user.id, providerAddress, ...(createdAt ? { createdAt } : {}) });
    }

    return { user, token, seed };
  }
});
