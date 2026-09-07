import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

registerFakeSdlSecretsKms();

const DSEQ = "1234";

describe("PATCH /v1/deployments/{dseq} route wiring", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const blockHttpService = container.resolve(BlockHttpService);

  let knownUsers: Record<string, UserOutput>;
  let knownApiKeys: Record<string, ReturnType<typeof createApiKey>>;
  let knownWallets: Record<string, UserWalletOutput[]>;

  beforeAll(async () => {
    await startJobQueues();
    await warmSealingKeyAsBootWould();
  }, 20_000);

  beforeEach(() => {
    knownUsers = {};
    knownApiKeys = {};
    knownWallets = {};

    vi.spyOn(userRepository, "findById").mockImplementation(async id =>
      knownUsers[id] ? { ...knownUsers[id], trial: false, userWallets: { isTrialing: false } } : undefined
    );
    vi.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async key => knownApiKeys[key!]);
    vi.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(faker.number.int({ min: 1000000, max: 10000000 }));
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(
      mock<UserWalletRepository>({
        findByUserId: async (id: string) => knownWallets[id],
        findOneByUserId: async (id: string) => knownWallets[id][0]
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await patch(undefined, { services: { web: { image: "nginx" } } });

    expect(response.status).toBe(401);
  });

  it("reaches the controller and answers 404 for a deployment the console recorded nothing for", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: { web: { image: "nginx" } } });

    expect(response.status).toBe(404);
  });

  it("refuses a body naming no services before it reaches the controller", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: {} });

    expect(response.status).toBe(400);
  });

  it("refuses a service patch naming no field before it reaches the controller", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: { web: {} } });

    expect(response.status).toBe(400);
  });

  it("refuses an env key that is not an environment variable name", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: { web: { env: { "A=B": "c" } } } });

    expect(response.status).toBe(400);
  });

  function patch(apiKey: string | undefined, data: Record<string, unknown>) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (apiKey) headers.set("x-api-key", apiKey);

    return app.request(`/v1/deployments/${DSEQ}`, { method: "PATCH", body: JSON.stringify({ data }), headers });
  }

  async function persistedUser() {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const apiKey = faker.string.alphanumeric(24);
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });

    knownUsers[dbUser.id] = user;
    knownApiKeys[apiKey] = createApiKey({ userId: dbUser.id });
    knownWallets[dbUser.id] = [createUserWallet({ userId: dbUser.id, address: createAkashAddress() })];

    return { user, apiKey };
  }
});
