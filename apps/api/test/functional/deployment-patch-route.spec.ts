import { faker } from "@faker-js/faker";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { CORE_CONFIG } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

registerFakeSdlSecretsKms();

const DSEQ = "1234";
const REPLACED_MANIFEST_VERSION = "AAAA";

describe("PATCH /v1/deployments/{dseq} route wiring", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const blockHttpService = container.resolve(BlockHttpService);
  const signerService = container.resolve(ManagedSignerService);
  const providerService = container.resolve(ProviderService);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

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
    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({
      code: 0,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
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

  it("refuses an empty seal offered as the only thing the patch would write", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: { web: {} }, sealedSecrets: "" });

    expect(response.status).toBe(400);
  });

  it("refuses an env key that is not an environment variable name", async () => {
    const { apiKey } = await persistedUser();

    const response = await patch(apiKey, { services: { web: { env: { "A=B": "c" } } } });

    expect(response.status).toBe(400);
  });

  it("answers 200 with the patched deployment under data", async () => {
    const { apiKey } = await patchableDeployment();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        deployment: expect.any(Object),
        escrow_account: expect.any(Object),
        leases: expect.arrayContaining([expect.any(Object)]),
        manifestVersion: expect.any(String)
      }
    });
  });

  it("hands back the manifest version it recorded rather than the one the patch replaced", async () => {
    const { apiKey, user } = await patchableDeployment();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    const { data } = (await response.json()) as { data: { manifestVersion: string } };
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: DSEQ });
    expect(data.manifestVersion).toBe(setting?.manifestVersion);
    expect(data.manifestVersion).not.toBe(REPLACED_MANIFEST_VERSION);
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

    return { user, apiKey, address: knownWallets[dbUser.id][0].address! };
  }

  async function patchableDeployment() {
    const { user, apiKey, address } = await persistedUser();

    await deploymentSettingRepository.upsertDefinition({
      userId: user.id,
      dseq: DSEQ,
      sdl: fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8"),
      manifestVersion: REPLACED_MANIFEST_VERSION
    });
    mockChainOf(address);

    return { user, apiKey, address };
  }

  function mockChainOf(address: string) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const leases = createManyLeaseApiResponses(1, { owner: address, dseq: DSEQ, state: "active" });

    nock(restUrl)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${DSEQ}`)
      .reply(200, createDeploymentInfoSeed({ owner: address, dseq: DSEQ }));
    nock(restUrl).persist().get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}`).reply(200, { leases });
    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}&pagination.limit=1000`)
      .reply(200, { leases });
  }
});
