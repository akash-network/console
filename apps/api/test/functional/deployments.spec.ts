import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { NotFound } from "http-errors";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { CORE_CONFIG } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import type { RestAkashDeploymentInfoResponse } from "@src/types/rest";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const OVERSIZED_FILLER = "z".repeat(4096);

registerFakeSdlSecretsKms();

describe("Deployments API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const providerService = container.resolve(ProviderService);
  const blockHttpService = container.resolve(BlockHttpService);
  const signerService = container.resolve(ManagedSignerService);
  const deploymentReaderService = container.resolve(DeploymentReaderService);

  let currentUser: UserOutput;
  let knownUsers: Record<string, UserOutput>;
  let knownApiKeys: Record<string, ApiKeyOutput>;
  let knownWallets: Record<string, UserWalletOutput[]>;
  let allWallets: UserWalletOutput[];
  let currentHeight: number;

  beforeAll(async () => {
    await startJobQueues();
    await warmSealingKeyAsBootWould();
  }, 20_000);

  beforeEach(() => {
    knownUsers = {};
    knownApiKeys = {};
    knownWallets = {};
    allWallets = [];
    currentHeight = faker.number.int({ min: 1000000, max: 10000000 });

    vi.spyOn(userRepository, "findById").mockImplementation(async (id: string) => {
      return Promise.resolve(
        knownUsers[id]
          ? {
              ...knownUsers[id],
              trial: false,
              userWallets: { isTrialing: false }
            }
          : undefined
      );
    });

    vi.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async (key: string | undefined) => {
      return knownApiKeys[key!];
    });

    vi.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(currentHeight);

    vi.spyOn(userWalletRepository, "findOneBy").mockImplementation(async (query: Partial<UserWalletOutput> | undefined) => {
      return Promise.resolve(allWallets.find(wallet => wallet.address === query?.address));
    });

    const fakeWalletRepository = {
      findByUserId: async (id: string) => {
        return Promise.resolve(knownWallets[id]);
      },
      findOneByUserId: async (id: string) => {
        return Promise.resolve(knownWallets[id][0]);
      },
      findFirst: async () => {
        return Promise.resolve(knownWallets[currentUser.id][0]);
      }
    } as unknown as UserWalletRepository;

    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(fakeWalletRepository);

    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });

    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(createLeaseStatus());
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  async function mockUser() {
    const userId = faker.string.uuid();
    const userApiKeySecret = faker.word.noun();
    const user = createUser({ userId });
    const apiKey = createApiKey({ userId });
    const wallets = [createUserWallet({ userId, address: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm" })];

    currentUser = user;
    knownUsers[userId] = user;
    knownApiKeys[userApiKeySecret] = apiKey;
    knownWallets[user.id] = wallets;
    allWallets.push(...wallets);

    return { user, userApiKeySecret, wallets };
  }

  /**
   * Persists a real user row, which every create and every SDL update needs: creating or updating a
   * deployment now records what that deployment is, and that record is FK-bound to the user. `mockUser`
   * fakes the user, and only suits paths that never record a definition.
   */
  async function mockPersistedUser() {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const userApiKeySecret = faker.word.noun();
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });
    const apiKey = createApiKey({ userId: dbUser.id });
    const wallets = [createUserWallet({ userId: dbUser.id, address: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm" })];

    currentUser = user;
    knownUsers[dbUser.id] = user;
    knownApiKeys[userApiKeySecret] = apiKey;
    knownWallets[dbUser.id] = wallets;
    allWallets.push(...wallets);

    return { user, userApiKeySecret, wallets };
  }

  async function setupDeploymentInfoMock(wallets: UserWalletOutput[], dseq: string, deploymentInfo?: RestAkashDeploymentInfoResponse) {
    const address = wallets[0].address;
    const defaultDeploymentInfo =
      deploymentInfo ||
      createDeploymentInfoSeed({
        owner: address!,
        dseq
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/list?filters.owner=${address}`)
      .reply(200, {
        deployments: [defaultDeploymentInfo]
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`)
      .reply(200, defaultDeploymentInfo);

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=9876`)
      .reply(404, {
        code: 404,
        message: "Deployment not found"
      });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(
        `/akash/deployment/${deploymentVersion}/deployments/list?filters.owner=${address}&pagination.limit=1&pagination.offset=0&pagination.count_total=true&pagination.reverse=false&filters.state=active`
      )
      .reply(200, {
        deployments: [defaultDeploymentInfo],
        pagination: {
          total: 1,
          next_key: null
        }
      });
    await createDeployment({ owner: wallets[0].address!, dseq });

    const leases = createManyLeaseApiResponses(2, {
      owner: address!,
      dseq,
      state: "active"
    });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${dseq}`)
      .reply(200, { leases });
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${dseq}&pagination.limit=1000`)
      .reply(200, { leases });
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=9876&pagination.limit=1000`)
      .reply(404, {
        code: 404,
        message: "Leases not found"
      });
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.state=active`)
      .reply(200, { leases });
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.state=active`)
      .reply(200, { leases });

    return defaultDeploymentInfo;
  }

  function setupDeploymentListMock(wallets: UserWalletOutput[], count: number = 2, state: string = "active") {
    const address = wallets[0].address;
    const deployments: RestAkashDeploymentInfoResponse[] = [];

    for (let i = 0; i < count; i++) {
      const dseq = faker.string.numeric();
      const deploymentInfo = createDeploymentInfoSeed({
        owner: address!,
        dseq,
        state
      });

      deployments.push(deploymentInfo);

      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${dseq}`)
        .reply(200, deploymentInfo);

      const leases = createManyLeaseApiResponses(2, {
        owner: address!,
        dseq,
        state: "active"
      });

      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${dseq}`)
        .reply(200, { leases });
    }

    return deployments;
  }

  describe("GET /v1/deployments", () => {
    it("returns deployment by dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      await setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        escrow_account: expect.any(Object),
        leases: expect.arrayContaining([expect.any(Object)]),
        consoleSettings: null
      });
    });

    it("returns what the console recorded for the deployment", async () => {
      const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
      const { userApiKeySecret, user, wallets } = await mockPersistedUser();
      await setupDeploymentInfoMock(wallets, dseq);
      const sdl = `version: '2.0' # ${faker.string.uuid()}`;
      await container.resolve(DeploymentSettingRepository).upsertDefinition({ userId: user.id, dseq, sdl, manifestVersion: "BAUG" });

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: { consoleSettings: unknown } };
      expect(result.data.consoleSettings).toEqual({ sdl, manifestVersion: "BAUG" });
    });

    it("reads a deployment for which the console recorded nothing", async () => {
      const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
      const { userApiKeySecret, wallets } = await mockPersistedUser();
      await setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: { deployment: unknown; consoleSettings: unknown } };
      expect(result.data.deployment).toEqual(expect.any(Object));
      expect(result.data.consoleSettings).toBeNull();
    });

    it("reads a deployment whose settings row carries no sdl", async () => {
      const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
      const { userApiKeySecret, user, wallets } = await mockPersistedUser();
      await setupDeploymentInfoMock(wallets, dseq);
      await container.resolve(DeploymentSettingRepository).create({ userId: user.id, dseq });

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: { consoleSettings: unknown } };
      expect(result.data.consoleSettings).toBeNull();
    });

    it("hands back none of what another user recorded for the same dseq", async () => {
      const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
      const owner = await mockPersistedUser();
      const otherUsersSdl = `version: '2.0' # ${faker.string.uuid()}`;
      await container.resolve(DeploymentSettingRepository).upsertDefinition({ userId: owner.user.id, dseq, sdl: otherUsersSdl, manifestVersion: "BAUG" });
      const reader = await mockPersistedUser();
      await setupDeploymentInfoMock(reader.wallets, dseq);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": reader.userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect((body as { data: { consoleSettings: unknown } }).data.consoleSettings).toBeNull();
      expect(JSON.stringify(body)).not.toContain(otherUsersSdl);
    });

    it("hands each user their own console settings for the same dseq", async () => {
      const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
      const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
      const first = await mockPersistedUser();
      const firstSdl = `version: '2.0' # ${faker.string.uuid()}`;
      await deploymentSettingRepository.upsertDefinition({ userId: first.user.id, dseq, sdl: firstSdl, manifestVersion: "BAUG" });
      const second = await mockPersistedUser();
      const secondSdl = `version: '2.0' # ${faker.string.uuid()}`;
      await deploymentSettingRepository.upsertDefinition({ userId: second.user.id, dseq, sdl: secondSdl, manifestVersion: "BAUH" });
      await setupDeploymentInfoMock(second.wallets, dseq);

      const readAs = async (apiKey: string) => {
        const response = await app.request(`/v1/deployments/${dseq}`, {
          method: "GET",
          headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
        });
        return (await response.json()) as { data: { consoleSettings: { sdl: string } | null } };
      };

      expect((await readAs(first.userApiKeySecret)).data.consoleSettings).toEqual({ sdl: firstSdl, manifestVersion: "BAUG" });
      expect((await readAs(second.userApiKeySecret)).data.consoleSettings).toEqual({ sdl: secondSdl, manifestVersion: "BAUH" });
    });

    it("returns 404 for an error in deployment info", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      await setupDeploymentInfoMock(wallets, dseq, createDeploymentInfoErrorSeed());

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized",
        code: "unauthorized",
        type: "client_error"
      });
    });

    it("returns 400 for invalid dseq 'undefined'", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments/undefined", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { data: { path: string[]; message: string }[] };
      expect(result.data.find(error => error.path.join(".") === "dseq")?.message).toContain("Expected bigint, received string");
    });

    it("returns 400 for invalid dseq with non-numeric characters", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments/abc123", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { data: { path: string[]; message: string }[] };
      expect(result.data.find(error => error.path.join(".") === "dseq")?.message).toContain("Expected bigint, received string");
    });

    it("returns all deployments when skip and limit are not provided", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 2);

      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .persist()
        .get(/\/akash\/deployment\/v1beta4\/deployments\/list\?.*/)
        .reply(200, {
          deployments,
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toEqual({
        deployments: expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.any(Object),
            escrow_account: expect.any(Object),
            leases: expect.arrayContaining([expect.any(Object)])
          })
        ]),
        pagination: {
          total: expect.any(Number),
          skip: 0,
          limit: expect.any(Number),
          hasMore: false
        }
      });
    });

    it("returns paginated list of deployments when skip and limit are provided", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 2, "active");

      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .persist()
        .get(/\/akash\/deployment\/v1beta4\/deployments\/list\?.*/)
        .reply(200, {
          deployments: deployments.slice(0, 1),
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments?skip=0&limit=1", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toEqual({
        deployments: [
          expect.objectContaining({
            deployment: expect.any(Object),
            escrow_account: expect.any(Object),
            leases: expect.arrayContaining([expect.any(Object)])
          })
        ],
        pagination: {
          total: expect.any(Number),
          skip: 0,
          limit: 1,
          hasMore: true
        }
      });
    });

    it("returns 400 if skip is negative", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments?skip=-1&limit=10", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 if limit is less than 1", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments?skip=0&limit=0", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("filters deployments by status", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const deployments = setupDeploymentListMock(wallets, 1, "active");

      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .persist()
        .get(/\/akash\/deployment\/v1beta4\/deployments\/list\?.*/)
        .reply(200, {
          deployments,
          pagination: {
            total: deployments.length,
            next_key: null
          }
        });

      const response = await app.request("/v1/deployments?status=active", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: { deployments: unknown[] } };
      expect(result.data.deployments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            deployment: expect.objectContaining({
              state: "active"
            })
          })
        ])
      );
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments", {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/deployments", () => {
    it("creates a deployment", async () => {
      const { userApiKeySecret } = await mockPersistedUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toEqual({
        dseq: expect.any(String),
        manifest: expect.any(String),
        signTx: {
          code: 200,
          transactionHash: expect.any(String),
          hash: expect.any(String),
          rawLog: expect.any(String)
        }
      });
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: "",
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 for an SDL invalid in a meaningful way", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/invalid-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("Invalid SDL");
    });

    it("returns 400 if the SDL sent is invalid", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: "invalid-sdl",
            deposit: 5.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("Invalid SDL");
    });

    it("creates a deployment without a deposit", async () => {
      const { userApiKeySecret } = await mockPersistedUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(201);
    });

    it("persists the runtime limit when one is requested", async () => {
      const { userApiKeySecret, user } = await mockPersistedUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            runtimeLimitHours: 6
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as { data: { dseq: string } };

      const setting = await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq: result.data.dseq });
      expect(setting).toMatchObject({ autoTopUpEnabled: true, runtimeLimitHours: 6, runtimeEndsAt: null });
    });

    it("records the sdl it was given", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.sdl).toContain("ghcr.io/akash-network/hello-akash-world");
    });

    it("records an sdl naming every env variable the submitted one declared", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.sdl).toContain("API_TOKEN=");
      expect(setting?.sdl).toContain("DATABASE_URL=");
      expect(setting?.sdl).toContain("INHERITED_FROM_HOST");
    });

    it("records an sdl carrying none of the submitted env values, referencing a sealed one in each place", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.sdl).not.toContain("PLACEHOLDER_API_TOKEN");
      expect(setting?.sdl).not.toContain("PLACEHOLDER_DB_PASSWORD");
      expect(setting?.sdl).not.toContain("db.example.test");
      expect(setting?.sdl).toContain("API_TOKEN=ac-secret://s0_e0");
      expect(setting?.sdl).toContain("DATABASE_URL=ac-secret://s0_e1");
      expect(setting?.sealedSecrets).toEqual(expect.any(String));
    });

    it("records an sdl referencing both halves of the submitted registry credentials and carrying neither", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.sdl).not.toContain("PLACEHOLDER_REGISTRY_USERNAME");
      expect(setting?.sdl).not.toContain("PLACEHOLDER_REGISTRY_PASSWORD");
      expect(setting?.sdl).toContain("username: ac-secret://s0_c_username");
      expect(setting?.sdl).toContain("password: ac-secret://s0_c_password");
    });

    it("records an sdl keeping the registry host and email, which carry no secret", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.sdl).toContain("host: registry.example.test");
      expect(setting?.sdl).toContain("email: placeholder@example.test");
    });

    it("records an sdl that is still a deployable SDL", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(container.resolve(SdlService).generateManifest(setting?.sdl ?? "").ok).toBe(true);
    });

    it("records the manifest version it commits on chain", async () => {
      const { setting } = await createDeploymentWithSecrets();

      expect(setting?.manifestVersion).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
      expect(Buffer.from(setting?.manifestVersion ?? "", "base64")).toHaveLength(32);
    });

    it("returns 400 for a non-integer runtime limit", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            runtimeLimitHours: 1.5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 for a runtime limit above the 48 hour cap", async () => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            runtimeLimitHours: 49
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it.each([0, -1])("returns 400 for a runtime limit of %s hours", async runtimeLimitHours => {
      const { userApiKeySecret } = await mockUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({
          data: {
            sdl: yml,
            runtimeLimitHours
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an sdl too large to store", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const response = await postOversizedDeployment(userApiKeySecret);

      expect(response.status).toBe(400);
    });

    it("says nothing about the sdl in the 400 it returns", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const response = await postOversizedDeployment(userApiKeySecret);

      expect(await response.text()).not.toContain(OVERSIZED_FILLER);
    });

    it("records nothing and broadcasts nothing for an sdl too large to store", async () => {
      const { userApiKeySecret, user } = await mockPersistedUser();

      await postOversizedDeployment(userApiKeySecret);

      expect(await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("returns 400 naming the offending value for an unrecognized ac- kind", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const response = await postDeploymentWithEnv(userApiKeySecret, "TOKEN=ac-var://TOKEN");

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-var://TOKEN");
    });

    it("returns 400 naming a value that merely opens with the reserved prefix", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const response = await postDeploymentWithEnv(userApiKeySecret, "MODE=ac-dc");

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-dc");
    });

    it("returns 400 naming a reference it holds no value for", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const response = await postDeploymentWithEnv(userApiKeySecret, "TOKEN=ac-secret://TOKEN");

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-secret://TOKEN");
    });

    it("records nothing and broadcasts nothing for an unrecognized ac- kind", async () => {
      const { userApiKeySecret, user } = await mockPersistedUser();

      await postDeploymentWithEnv(userApiKeySecret, "TOKEN=ac-var://TOKEN");

      expect(await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("resolves a kind registered after boot that it would otherwise reject", async () => {
      const { userApiKeySecret } = await mockPersistedUser();

      const beforeRegistration = await postDeploymentWithEnv(userApiKeySecret, "MODE=ac-probe://MODE");
      container.resolve(SdlReferenceService).register({ kind: "probe", resolve: ({ name }) => `resolved-${name}` });
      const afterRegistration = await postDeploymentWithEnv(userApiKeySecret, "MODE=ac-probe://MODE");

      expect(beforeRegistration.status).toBe(400);
      expect(afterRegistration.status).toBe(201);
    });

    function postDeploymentWithEnv(userApiKeySecret: string, entry: string) {
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      return app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: yml.replace("    expose:", `    env:\n      - "${entry}"\n    expose:`) } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });
    }

    function postOversizedDeployment(userApiKeySecret: string) {
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
      const args = Array.from({ length: 40 }, () => `      - ${OVERSIZED_FILLER}`).join("\n");

      return app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: yml.replace("    expose:", `    args:\n${args}\n    expose:`) } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });
    }

    async function createDeploymentWithSecrets() {
      const { userApiKeySecret, user } = await mockPersistedUser();
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl-with-secrets.yml"), "utf8");

      const response = await app.request("/v1/deployments", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: yml } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as { data: { dseq: string } };

      return { setting: await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq: result.data.dseq }) };
    }
  });

  describe("DELETE /v1/deployments/{dseq}", () => {
    it("should close a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      await setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        transactionHash: "test-hash",
        rawLog: "success"
      };

      vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValueOnce(mockTxResult);

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toEqual({
        data: {
          success: true
        }
      });
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      vi.spyOn(deploymentReaderService, "findByWalletAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized",
        code: "unauthorized",
        type: "client_error"
      });
    });

    it("should return 400 for invalid dseq 'undefined'", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments/undefined", {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { data: { path: string[]; message: string }[] };
      expect(result.data.find(error => error.path.join(".") === "dseq")?.message).toContain("Expected bigint, received string");
    });

    it("should return 400 for invalid dseq with non-numeric characters", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments/abc123", {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { data: { path: string[]; message: string }[] };
      expect(result.data.find(error => error.path.join(".") === "dseq")?.message).toContain("Expected bigint, received string");
    });

    it("should return 400 for negative dseq", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request("/v1/deployments/-123", {
        method: "DELETE",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { data: { path: string[]; code: string }[] };
      console.dir(result, { depth: null });
      expect(result.data.find(error => error.path.join(".") === "dseq")?.code).toBe("too_small");
    });
  });

  describe("POST /v1/deployments/{dseq}/deposit", () => {
    it("should deposit into a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockUser();
      const dseq = "1234";
      await setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        transactionHash: "test-hash",
        rawLog: "success"
      };

      vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValueOnce(mockTxResult);

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq,
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      vi.spyOn(deploymentReaderService, "findByWalletAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq,
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deposit-deployment", {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq: "1234",
            deposit: 5
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized",
        code: "unauthorized",
        type: "client_error"
      });
    });

    it("should return 400 if deposit amount is not provided", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      const response = await app.request(`/v1/deposit-deployment`, {
        method: "POST",
        body: JSON.stringify({
          data: {
            dseq
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /v1/deployments/{dseq}", () => {
    it("should update a deployment successfully", async () => {
      const { userApiKeySecret, wallets } = await mockPersistedUser();
      const dseq = "1234";
      await setupDeploymentInfoMock(wallets, dseq);

      const mockTxResult = {
        code: 0,
        hash: "test-hash",
        transactionHash: "test-hash",
        rawLog: "success"
      };

      vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValueOnce(mockTxResult);

      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: yml
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { data: unknown };
      expect(result.data).toEqual({
        deployment: expect.any(Object),
        escrow_account: expect.any(Object),
        leases: expect.arrayContaining([expect.any(Object)])
      });
    });

    it("should return 404 if deployment does not exist", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      vi.spyOn(deploymentReaderService, "findByWalletAndDseq").mockRejectedValueOnce(new NotFound("Deployment not found"));

      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: yml
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
      const result = await response.json();
      expect(result).toEqual({
        error: "NotFoundError",
        message: "Deployment not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("should return 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/1234", {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: "test-sdl"
          }
        }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result).toEqual({
        error: "UnauthorizedError",
        message: "Unauthorized",
        code: "unauthorized",
        type: "client_error"
      });
    });

    it("should return 400 if SDL is invalid", async () => {
      const { userApiKeySecret } = await mockUser();
      const dseq = "1234";

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            sdl: "invalid-sdl"
          }
        }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("Invalid SDL");
    });

    it("replaces the sdl and the manifest version an earlier write recorded", async () => {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();
      const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq, sdl: "version: '2.0'", manifestVersion: "AAAA" });

      const response = await putDeployment({ userApiKeySecret, dseq, sdlMock: "hello-world-sdl.yml" });

      expect(response.status).toBe(200);
      const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      expect(setting?.sdl).toContain("ghcr.io/akash-network/hello-akash-world");
      expect(setting?.manifestVersion).not.toBe("AAAA");
      expect(Buffer.from(setting?.manifestVersion ?? "", "base64")).toHaveLength(32);
    });

    it("records the definition of a deployment updated before it had one", async () => {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();
      const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toBeUndefined();

      const response = await putDeployment({ userApiKeySecret, dseq, sdlMock: "hello-world-sdl.yml" });

      expect(response.status).toBe(200);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq })).toMatchObject({
        sdl: expect.stringContaining("ghcr.io/akash-network/hello-akash-world"),
        manifestVersion: expect.stringMatching(/^[A-Za-z0-9+/]+={0,2}$/)
      });
    });

    it("records an sdl naming every env variable the submitted one declared", async () => {
      const { setting } = await updateDeploymentWithSecrets();

      expect(setting?.sdl).toContain("API_TOKEN=");
      expect(setting?.sdl).toContain("DATABASE_URL=");
      expect(setting?.sdl).toContain("INHERITED_FROM_HOST");
    });

    it("records an sdl carrying none of the submitted env values, referencing a sealed one in each place", async () => {
      const { setting } = await updateDeploymentWithSecrets();

      expect(setting?.sdl).not.toContain("PLACEHOLDER_API_TOKEN");
      expect(setting?.sdl).not.toContain("PLACEHOLDER_DB_PASSWORD");
      expect(setting?.sdl).not.toContain("db.example.test");
      expect(setting?.sdl).toContain("API_TOKEN=ac-secret://s0_e0");
      expect(setting?.sdl).toContain("DATABASE_URL=ac-secret://s0_e1");
      expect(setting?.sealedSecrets).toEqual(expect.any(String));
    });

    it("records an sdl referencing both halves of the submitted registry credentials and carrying neither", async () => {
      const { setting } = await updateDeploymentWithSecrets();

      expect(setting?.sdl).not.toContain("PLACEHOLDER_REGISTRY_USERNAME");
      expect(setting?.sdl).not.toContain("PLACEHOLDER_REGISTRY_PASSWORD");
      expect(setting?.sdl).toContain("username: ac-secret://s0_c_username");
      expect(setting?.sdl).toContain("password: ac-secret://s0_c_password");
    });

    it("records an sdl keeping the registry host and email, which carry no secret", async () => {
      const { setting } = await updateDeploymentWithSecrets();

      expect(setting?.sdl).toContain("host: registry.example.test");
      expect(setting?.sdl).toContain("email: placeholder@example.test");
    });

    it("stores a token bound to the deployment it updated, opening to every value the sdl carried", async () => {
      const { user, setting } = await updateDeploymentWithSecrets();

      await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({
        s0_e0: "PLACEHOLDER_API_TOKEN",
        s0_e1: "postgres://placeholder:PLACEHOLDER_DB_PASSWORD@db.example.test:5432/app?ssl=true",
        s0_c_username: "PLACEHOLDER_REGISTRY_USERNAME",
        s0_c_password: "PLACEHOLDER_REGISTRY_PASSWORD"
      });
    });

    it("refuses an update that resubmits the sdl it stored, whose references it holds no values for", async () => {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();
      await putDeployment({ userApiKeySecret, dseq, sdlMock: "hello-world-sdl-with-secrets.yml" });
      const stored = await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq });

      const response = await app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: stored?.sdl } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("ac-secret://s0_e0");
    });

    it("records an sdl that is still a deployable SDL", async () => {
      const { setting } = await updateDeploymentWithSecrets();

      expect(container.resolve(SdlService).generateManifest(setting?.sdl ?? "").ok).toBe(true);
    });

    it("returns 400 naming the offending value for an unrecognized ac- kind", async () => {
      const { userApiKeySecret, dseq } = await setupUpdatableDeployment();

      const response = await putDeploymentWithEnv({ userApiKeySecret, dseq, entry: "TOKEN=ac-var://TOKEN" });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-var://TOKEN");
    });

    it("returns 400 naming a reference it holds no value for", async () => {
      const { userApiKeySecret, dseq } = await setupUpdatableDeployment();

      const response = await putDeploymentWithEnv({ userApiKeySecret, dseq, entry: "TOKEN=ac-secret://TOKEN" });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-secret://TOKEN");
    });

    it("returns 400 naming a registry credential reference it holds no value for", async () => {
      const { userApiKeySecret, dseq } = await setupUpdatableDeployment();

      const response = await putDeploymentWithCredentials({ userApiKeySecret, dseq, password: "ac-secret://REG_PASS" });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("ac-secret://REG_PASS");
    });

    it("returns 400 for a reserved value in a registry credential", async () => {
      const { userApiKeySecret, dseq } = await setupUpdatableDeployment();

      const response = await putDeploymentWithCredentials({ userApiKeySecret, dseq, password: "ac-dc-forever" });

      expect(response.status).toBe(400);
      const result = (await response.json()) as { message: string };
      expect(result.message).toContain("reserved");
    });

    it("commits the manifest version of the very manifest it sends the providers", async () => {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();
      const sdlService = container.resolve(SdlService);
      const manifest = sdlService.generateManifest(fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8"));
      const { groups } = (manifest as Extract<typeof manifest, { ok: true }>).value;

      await putDeployment({ userApiKeySecret, dseq, sdlMock: "hello-world-sdl.yml" });

      const setting = await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq });
      expect(setting?.manifestVersion).toBe(Buffer.from(await sdlService.generateManifestVersion(groups)).toString("base64"));
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: manifestToSortedJSON(groups) }));
    });

    it("records nothing and sends no manifest for an unrecognized ac- kind", async () => {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();

      await putDeploymentWithEnv({ userApiKeySecret, dseq, entry: "TOKEN=ac-var://TOKEN" });

      expect(await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq })).toBeUndefined();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    function putDeploymentWithEnv({ userApiKeySecret, dseq, entry }: { userApiKeySecret: string; dseq: string; entry: string }) {
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

      return app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: yml.replace("    expose:", `    env:\n      - "${entry}"\n    expose:`) } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });
    }

    function putDeploymentWithCredentials({ userApiKeySecret, dseq, password }: { userApiKeySecret: string; dseq: string; password: string }) {
      const yml = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
      const credentials = [
        "    credentials:",
        "      host: registry.example.test",
        `      username: ${faker.string.alphanumeric(10)}`,
        `      password: ${JSON.stringify(password)}`,
        ""
      ].join("\n");

      return app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: yml.replace("    expose:", `${credentials}    expose:`) } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });
    }

    async function openStoredToken(user: { id: string }, dseq: string, token: string) {
      return await container.resolve(ExecutionContextService).runWithContext(async () => {
        container.resolve(AuthService).currentUser = { id: user.id } as never;

        return JSON.parse(await container.resolve(SecretCipherService).decrypt(user.id, token, { sub: user.id, dseq })) as Record<string, string>;
      });
    }

    async function setupUpdatableDeployment() {
      const { userApiKeySecret, user, wallets } = await mockPersistedUser();
      const dseq = "1234";
      await setupDeploymentInfoMock(wallets, dseq);

      return { userApiKeySecret, user, dseq };
    }

    function putDeployment({ userApiKeySecret, dseq, sdlMock }: { userApiKeySecret: string; dseq: string; sdlMock: string }) {
      const yml = fs.readFileSync(path.resolve(__dirname, `../mocks/${sdlMock}`), "utf8");

      return app.request(`/v1/deployments/${dseq}`, {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: yml } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });
    }

    async function updateDeploymentWithSecrets() {
      const { userApiKeySecret, user, dseq } = await setupUpdatableDeployment();

      const response = await putDeployment({ userApiKeySecret, dseq, sdlMock: "hello-world-sdl-with-secrets.yml" });

      expect(response.status).toBe(200);

      return { user, setting: await container.resolve(DeploymentSettingRepository).findOneBy({ userId: user.id, dseq }) };
    }
  });

  describe("GET /v1/addresses/{address}/deployments/{skip}/{limit}", () => {
    it("returns deployment by dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      await setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/addresses/${wallets[0].address}/deployments/0/1?status=active`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      const result = await response.json();
      expect(result).toEqual({
        count: 1,
        results: [
          expect.objectContaining({
            owner: wallets[0].address,
            dseq,
            status: "active",
            createdHeight: expect.any(Number),
            escrowAccount: expect.any(Object),
            cpuUnits: expect.any(Number),
            gpuUnits: expect.any(Number),
            memoryQuantity: expect.any(Number),
            storageQuantity: expect.any(Number),
            leases: expect.arrayContaining([expect.any(Object)])
          })
        ]
      });
    });
  });

  describe("GET /v1/deployment/{owner}/{dseq}", () => {
    it("returns deployment by owner and dseq", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      await setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployment/${wallets[0].address}/${dseq}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as { owner: string; dseq: string };
      expect(result.owner).toEqual(wallets[0].address);
      expect(result.dseq).toEqual(dseq);
    });

    it("returns 404 when deployment is not found", async () => {
      const dseq = "1234";
      const { userApiKeySecret, wallets } = await mockUser();
      await setupDeploymentInfoMock(wallets, dseq);

      const response = await app.request(`/v1/deployment/${wallets[0].address}/9876`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(404);
    });

    it("returns 400 when owner is not a valid akash address", async () => {
      const { userApiKeySecret } = await mockUser();

      const response = await app.request(`/v1/deployment/invalid/1234`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": userApiKeySecret })
      });

      expect(response.status).toBe(400);
    });
  });
});
