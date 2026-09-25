import { faker } from "@faker-js/faker";
import { CompactEncrypt } from "jose";
import nock from "nock";
import { createHash, randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { CORE_CONFIG } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, SDL_SECRETS_KID, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentInfoGroupsFromSdl, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const { publicKey } = registerFakeSdlSecretsKms();

const DSEQ = "4321";

function sdlWithEnv(env: string[]) {
  return [
    'version: "2.0"',
    "services:",
    "  web:",
    "    image: nginx",
    "    env:",
    ...env.map(entry => `      - ${JSON.stringify(entry)}`),
    "    expose:",
    "      - port: 80",
    "        as: 80",
    "        to:",
    "          - global: true",
    "profiles:",
    "  compute:",
    "    web:",
    "      resources:",
    "        cpu:",
    "          units: 0.1",
    "        memory:",
    "          size: 128Mi",
    "        storage:",
    "          - size: 128Mi",
    "  placement:",
    "    dcloud:",
    "      pricing:",
    "        web:",
    "          denom: uakt",
    "          amount: 1000",
    "deployment:",
    "  web:",
    "    dcloud:",
    "      profile: web",
    "      count: 1",
    ""
  ].join("\n");
}

describe("Deployment definitions", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const blockHttpService = container.resolve(BlockHttpService);
  const signerService = container.resolve(ManagedSignerService);
  const providerService = container.resolve(ProviderService);
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

  beforeAll(async () => {
    await startJobQueues();
    await warmSealingKeyAsBootWould();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("POST /v1/deployments/{dseq}/definition", () => {
    it("records an sdl that resolves to the version the deployment runs and answers with the stored definition", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl } });

      const response = await record(apiKey, { sdl });

      expect(response.status).toBe(201);
      const setting = await settingOf(user);
      expect(setting).toMatchObject({ sdl: expect.stringContaining("image: nginx"), manifestVersion: await versionOf(sdl) });
      expect(await response.json()).toEqual({ data: { sdl: setting!.sdl, manifestVersion: setting!.manifestVersion } });
    });

    it("seals every value of an sdl that carries no seal, as a create does", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl } });

      await record(apiKey, { sdl });

      expect((await settingOf(user))?.sdl).toContain("LOG_LEVEL=ac-secret://s0_e0");
      await expect(openStored(user)).resolves.toEqual({ s0_e0: "debug" });
    });

    it("sends no deployment update and no manifest", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey } = await setup({ runs: { sdl } });
      const sendsUpdate = vi.spyOn(signerService, "executeDerivedDecodedTxByUserId");
      const sendsManifest = vi.spyOn(providerService, "sendManifest");

      await record(apiKey, { sdl });

      expect(sendsUpdate).not.toHaveBeenCalled();
      expect(sendsManifest).not.toHaveBeenCalled();
    });

    it("stores a sealed value encrypted and a plain variable as submitted, returning neither value", async () => {
      const token = randomUUID();
      const sdl = sdlWithEnv(["API_TOKEN=ac-secret://API_TOKEN", "LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl, secrets: { API_TOKEN: token } } });

      const response = await record(apiKey, { sdl, sealedSecrets: await sealFor(user, { API_TOKEN: token }, sdl) });

      expect(response.status).toBe(201);
      expect(await response.text()).not.toContain(token);
      const setting = await settingOf(user);
      expect(setting?.sdl).toContain("LOG_LEVEL=debug");
      expect(setting?.sdl).toContain("API_TOKEN=ac-secret://API_TOKEN");
      expect(setting?.sdl).not.toContain(token);
      await expect(openStored(user)).resolves.toEqual({ API_TOKEN: token });
    });

    it("refuses an sdl that does not resolve to the version the deployment runs, recording nothing", async () => {
      const { apiKey, user } = await setup({ runs: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } });

      const response = await record(apiKey, { sdl: sdlWithEnv(["LOG_LEVEL=info"]) });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "deployment_definition_mismatch" });
      expect(await settingOf(user)).toBeUndefined();
    });

    it("refuses to record over a definition the console already holds, leaving it as it was", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl } });
      await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: DSEQ, sdl: "version: '2.0'", manifestVersion: "AAAA" });

      const response = await record(apiKey, { sdl });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "deployment_definition_exists" });
      expect(await settingOf(user)).toMatchObject({ sdl: "version: '2.0'", manifestVersion: "AAAA" });
    });

    it("fills a row the console keeps without a definition, keeping its name", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl } });
      await deploymentSettingRepository.upsertName({ userId: user.id, dseq: DSEQ, name: "web" });

      const response = await record(apiKey, { sdl });

      expect(response.status).toBe(201);
      expect(await settingOf(user)).toMatchObject({ name: "web", manifestVersion: await versionOf(sdl) });
    });

    it("records the definition of a closed deployment", async () => {
      const sdl = sdlWithEnv(["LOG_LEVEL=debug"]);
      const { apiKey, user } = await setup({ runs: { sdl, state: "closed" } });

      const response = await record(apiKey, { sdl });

      expect(response.status).toBe(201);
      expect(await settingOf(user)).toMatchObject({ manifestVersion: await versionOf(sdl), closed: true, autoTopUpEnabled: false });
    });

    it("answers 404 for a deployment the caller does not hold", async () => {
      const { apiKey, user, address } = await setup({ runs: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } });
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=9876`)
        .reply(404, { code: 404, message: "Deployment not found" });

      const response = await app.request("/v1/deployments/9876/definition", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } }),
        headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
      });

      expect(response.status).toBe(404);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: "9876" })).toBeUndefined();
    });

    it("answers 401 for an unauthenticated request", async () => {
      const response = await app.request(`/v1/deployments/${DSEQ}/definition`, {
        method: "POST",
        body: JSON.stringify({ data: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /v1/deployments/{dseq} carrying a seal", () => {
    it("stores the sealed values encrypted and the plain variables as submitted", async () => {
      const token = randomUUID();
      const { apiKey, user } = await setup({ runs: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } });
      const sdl = sdlWithEnv(["API_TOKEN=ac-secret://API_TOKEN", "LOG_LEVEL=info"]);

      const response = await update(apiKey, { sdl, sealedSecrets: await sealFor(user, { API_TOKEN: token }, sdl) });

      expect(response.status).toBe(200);
      const setting = await settingOf(user);
      expect(setting?.sdl).toContain("LOG_LEVEL=info");
      expect(setting?.sdl).toContain("API_TOKEN=ac-secret://API_TOKEN");
      await expect(openStored(user)).resolves.toEqual({ API_TOKEN: token });
    });

    it("records the version of the manifest resolved with the sealed values", async () => {
      const token = randomUUID();
      const { apiKey, user } = await setup({ runs: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } });
      const sdl = sdlWithEnv(["API_TOKEN=ac-secret://API_TOKEN"]);

      await update(apiKey, { sdl, sealedSecrets: await sealFor(user, { API_TOKEN: token }, sdl) });

      expect(await settingOf(user)).toMatchObject({ manifestVersion: await versionOf(sdl, { API_TOKEN: token }) });
    });

    it("refuses a seal bound to another sdl, recording nothing", async () => {
      const { apiKey, user } = await setup({ runs: { sdl: sdlWithEnv(["LOG_LEVEL=debug"]) } });
      const sdl = sdlWithEnv(["API_TOKEN=ac-secret://API_TOKEN"]);

      const response = await update(apiKey, {
        sdl,
        sealedSecrets: await sealFor(user, { API_TOKEN: randomUUID() }, sdlWithEnv(["API_TOKEN=ac-secret://OTHER"]))
      });

      expect(response.status).toBe(403);
      expect(await settingOf(user)).toBeUndefined();
    });
  });

  function record(apiKey: string, data: { sdl: string; sealedSecrets?: string }) {
    return app.request(`/v1/deployments/${DSEQ}/definition`, {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  function update(apiKey: string, data: { sdl: string; sealedSecrets?: string }) {
    return app.request(`/v1/deployments/${DSEQ}`, {
      method: "PUT",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function versionOf(sdl: string, secrets: Record<string, string> = {}) {
    const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });

    if (!resolved.ok) throw new Error("the fixture sdl does not resolve");

    return Buffer.from(resolved.value.manifestVersion).toString("base64");
  }

  async function settingOf(user: UserOutput) {
    return await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: DSEQ });
  }

  async function openStored(user: UserOutput) {
    const setting = await settingOf(user);

    return await container.resolve(ExecutionContextService).runWithContext(async () => {
      container.resolve(AuthService).currentUser = user;

      return await container.resolve(SdlSecretsService).openStored({ userId: user.id, dseq: DSEQ, sealedSecrets: setting!.sealedSecrets! });
    });
  }

  async function sealFor(user: UserOutput, secrets: Record<string, string>, boundTo: string) {
    return await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
      .setProtectedHeader({
        alg: SDL_SECRETS_SEAL_ALGORITHM,
        enc: SDL_SECRETS_CONTENT_ENCRYPTION,
        kid: SDL_SECRETS_KID,
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 300,
        sdlHash: createHash("sha256").update(boundTo, "utf8").digest("base64url")
      })
      .encrypt(publicKey);
  }

  async function mockChain(address: string, runs: { sdl: string; secrets?: Record<string, string>; state?: "active" | "closed" }) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const info = createDeploymentInfoSeed({
      owner: address,
      dseq: DSEQ,
      state: runs.state ?? "active",
      version: await versionOf(runs.sdl, runs.secrets),
      groups: createDeploymentInfoGroupsFromSdl({ sdl: runs.sdl, owner: address, dseq: DSEQ })
    });
    const leases = runs.state === "closed" ? [] : createManyLeaseApiResponses(1, { owner: address, dseq: DSEQ, state: "active" });

    nock(restUrl).persist().get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${DSEQ}`).reply(200, info);
    nock(restUrl).persist().get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}`).reply(200, { leases });
    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}&pagination.limit=1000`)
      .reply(200, { leases });

    await createDeployment({ owner: address, dseq: DSEQ });
  }

  async function setup(input: { runs: { sdl: string; secrets?: Record<string, string>; state?: "active" | "closed" } }) {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const apiKey = faker.string.alphanumeric(24);
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });
    const address = createAkashAddress();
    const wallets = [createUserWallet({ userId: dbUser.id, address })];
    const apiKeys: Record<string, ReturnType<typeof createApiKey>> = { [apiKey]: createApiKey({ userId: dbUser.id }) };

    vi.spyOn(userRepository, "findById").mockImplementation(async id =>
      id === dbUser.id ? { ...user, trial: false, userWallets: { isTrialing: false } } : undefined
    );
    vi.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async key => apiKeys[key!]);
    vi.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(faker.number.int({ min: 1000000, max: 10000000 }));
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(
      mock<UserWalletRepository>({
        findByUserId: async () => wallets,
        findOneByUserId: async () => wallets[0]
      })
    );
    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(createLeaseStatus());
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue(mock());

    await mockChain(address, input.runs);

    return { user, apiKey, address };
  }
});
