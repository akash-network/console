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
import { seedPersonalOrganizationIdOf } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentInfoGroupsFromSdl, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const { client: kmsClient, publicKey } = registerFakeSdlSecretsKms();

const DSEQ = "1234";

function sdlWith(env: string[], { image = "nginx", cpu = 0.1 }: { image?: string; cpu?: number } = {}) {
  return [
    'version: "2.0"',
    "services:",
    "  web:",
    `    image: ${image}`,
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
    `          units: ${cpu}`,
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

describe("PUT /v1/deployments/{dseq}/definition", () => {
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

  describe("a resubmitted sdl that sends no secret values", () => {
    it("keeps every stored value its references still name", async () => {
      const { apiKey, user, secrets } = await setup();

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }) });

      expect(response.status).toBe(200);
      expect((await settingOf(user))?.sdl).toContain("nginx:1.27");
      await expect(openStored(user)).resolves.toEqual(secrets);
    });

    it("pushes providers a manifest that carries the kept values", async () => {
      const { apiKey, secrets } = await setup();

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }) });

      expect(providerService.sendManifest).toHaveBeenCalledWith(
        expect.objectContaining({ dseq: DSEQ, manifest: expect.stringContaining(`API_TOKEN=${secrets.s0_e0}`) })
      );
    });

    it("drops a stored value no reference names any longer", async () => {
      const { apiKey, user, secrets } = await setup();

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0"]) });

      expect(response.status).toBe(200);
      await expect(openStored(user)).resolves.toEqual({ s0_e0: secrets.s0_e0 });
    });

    it("answers with the version it recorded", async () => {
      const { apiKey, user } = await setup();

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }) });

      const { data } = (await response.json()) as { data: { manifestVersion: string } };
      expect(data.manifestVersion).toBe((await settingOf(user))!.manifestVersion);
    });
  });

  describe("a resubmitted sdl that sets one value", () => {
    it("replaces only that value when secretEnv names it", async () => {
      const { apiKey, user, secrets } = await setup();
      const rotated = randomUUID();

      const response = await replace(apiKey, {
        sdl: sdlWith([`API_TOKEN=${rotated}`, "DATABASE_URL=ac-secret://s0_e1"]),
        secretEnv: ["API_TOKEN"]
      });

      expect(response.status).toBe(200);
      expect((await settingOf(user))?.sdl).not.toContain(rotated);
      expect(Object.values(await openStored(user)).sort()).toEqual([rotated, secrets.s0_e1].sort());
    });

    it("takes a value from a seal bound to the submitted sdl", async () => {
      const { apiKey, user, secrets } = await setup();
      const rotated = randomUUID();
      const sdl = sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"]);

      const response = await replace(apiKey, { sdl, sealedSecrets: await sealFor(user, { s0_e0: rotated }, sdl) });

      expect(response.status).toBe(200);
      await expect(openStored(user)).resolves.toEqual({ s0_e0: rotated, s0_e1: secrets.s0_e1 });
    });

    it("refuses a seal bound to the stored sdl instead", async () => {
      const { apiKey, user, sdl: stored } = await setup();

      const response = await replace(apiKey, {
        sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }),
        sealedSecrets: await sealFor(user, { s0_e0: randomUUID() }, stored)
      });

      expect(response.status).toBe(403);
    });
  });

  describe("plain values", () => {
    it("keeps one the deployment stores in the clear readable when it is sent back unchanged", async () => {
      const { apiKey, user } = await setup({ env: ["API_TOKEN=ac-secret://s0_e0", "MODE=production"] });

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "MODE=production"], { image: "nginx:1.27" }) });

      expect((await settingOf(user))?.sdl).toContain("MODE=production");
    });

    it("seals one the request adds when it says nothing about which values are secret", async () => {
      const { apiKey, user } = await setup({ env: ["API_TOKEN=ac-secret://s0_e0"] });

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "MODE=production"]) });

      expect((await settingOf(user))?.sdl).not.toContain("MODE=production");
      expect(Object.values(await openStored(user))).toContain("production");
    });

    it("keeps one the request adds readable when secretEnv is empty", async () => {
      const { apiKey, user } = await setup({ env: ["API_TOKEN=ac-secret://s0_e0"] });

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "MODE=production"]), secretEnv: [] });

      expect((await settingOf(user))?.sdl).toContain("MODE=production");
    });

    it("seals one the deployment stores in the clear once secretEnv names it", async () => {
      const { apiKey, user } = await setup({ env: ["API_TOKEN=ac-secret://s0_e0", "MODE=production"] });

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "MODE=production"]), secretEnv: ["MODE"] });

      expect((await settingOf(user))?.sdl).not.toContain("MODE=production");
    });
  });

  describe("a refusal", () => {
    it("names a reference that has neither a new value nor a stored one", async () => {
      const { apiKey } = await setup();

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "NEW_KEY=ac-secret://NEW_KEY"]) });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("ac-secret://NEW_KEY");
    });

    it("persists nothing", async () => {
      const { apiKey, user } = await setup();
      const before = await settingOf(user);

      await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "NEW_KEY=ac-secret://NEW_KEY"]) });

      expect(await settingOf(user)).toMatchObject({ sdl: before!.sdl, manifestVersion: before!.manifestVersion, sealedSecrets: before!.sealedSecrets });
    });

    it("answers 422 with a code for a change only a new deployment can take", async () => {
      const { apiKey } = await setup();

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { cpu: 0.5 }) });

      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ code: "deployment_resources_changed" });
    });

    it("answers 409 with a code when the deployment moved on from the version it names", async () => {
      const { apiKey } = await setup();

      const response = await replace(apiKey, {
        sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }),
        ifManifestVersion: "AAAAmovedon"
      });

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "deployment_definition_changed" });
    });

    it("answers 404 for a deployment the console recorded no sdl for", async () => {
      const { apiKey } = await setup({ record: false });

      const response = await replace(apiKey, { sdl: sdlWith(["API_TOKEN=plain"]) });

      expect(response.status).toBe(404);
    });

    it("rejects an unauthenticated request", async () => {
      const response = await app.request(`/v1/deployments/${DSEQ}/definition`, {
        method: "PUT",
        body: JSON.stringify({ data: { sdl: sdlWith([]) } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });
  });

  async function recordedVersionFor(sdl: string, secrets: Record<string, string>) {
    const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });

    return resolved.ok ? Buffer.from(resolved.value.manifestVersion).toString("base64") : Buffer.from("unresolvable-fixture").toString("base64");
  }

  function replace(apiKey: string, data: Record<string, unknown>) {
    return app.request(`/v1/deployments/${DSEQ}/definition`, {
      method: "PUT",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function settingOf(user: UserOutput) {
    return await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: DSEQ });
  }

  async function openStored(user: UserOutput) {
    const setting = await settingOf(user);

    return await container.resolve(ExecutionContextService).runWithContext(async () => {
      container.resolve(AuthService).currentUser = user;

      return await container
        .resolve(SdlSecretsService)
        .openStored({ userId: user.id, organizationId: setting!.organizationId, dseq: DSEQ, sealedSecrets: setting!.sealedSecrets! });
    });
  }


  async function sealFor(user: UserOutput, secrets: Record<string, string>, boundTo?: string) {
    return await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
      .setProtectedHeader({
        alg: SDL_SECRETS_SEAL_ALGORITHM,
        enc: SDL_SECRETS_CONTENT_ENCRYPTION,
        kid: SDL_SECRETS_KID,
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 300,
        ...(boundTo === undefined ? {} : { sdlHash: createHash("sha256").update(boundTo, "utf8").digest("base64url") })
      })
      .encrypt(publicKey);
  }


  function referencedNamesIn(env: string[]) {
    return env.flatMap(entry => entry.match(/ac-secret:\/\/([A-Za-z_][A-Za-z0-9_]*)/)?.slice(1) ?? []);
  }

  async function mockChain(address: string, sdl: string) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const info = createDeploymentInfoSeed({
      owner: address,
      dseq: DSEQ,
      groups: createDeploymentInfoGroupsFromSdl({ sdl, owner: address, dseq: DSEQ })
    });
    const leases = createManyLeaseApiResponses(1, { owner: address, dseq: DSEQ, state: "active" });

    nock(restUrl).persist().get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${DSEQ}`).reply(200, info);
    nock(restUrl).persist().get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}`).reply(200, { leases });
    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}&pagination.limit=1000`)
      .reply(200, { leases });

    await createDeployment({ owner: address, dseq: DSEQ });
  }

  async function setup(input: { secrets?: Record<string, string>; env?: string[]; record?: boolean } = {}) {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const organizationId = await seedPersonalOrganizationIdOf(dbUser.id);
    const apiKey = faker.string.alphanumeric(24);
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });
    const address = createAkashAddress();
    const wallets = [createUserWallet({ userId: dbUser.id, organizationId, address })];
    const apiKeys: Record<string, ReturnType<typeof createApiKey>> = { [apiKey]: createApiKey({ userId: dbUser.id, organizationId }) };

    vi.spyOn(userRepository, "findById").mockImplementation(async id =>
      id === dbUser.id ? { ...user, trial: false, userWallets: { isTrialing: false } } : undefined
    );
    vi.spyOn(apiKeyAuthService, "getAndValidateApiKeyFromHeader").mockImplementation(async key => apiKeys[key!]);
    vi.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(faker.number.int({ min: 1000000, max: 10000000 }));
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(
      mock<UserWalletRepository>({
        findByUserId: async () => wallets,
        findOneByUserId: async () => wallets[0],
        findOneUsedBy: async () => wallets[0]
      })
    );
    vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(createLeaseStatus());
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue(mock());

    const env = input.env ?? ["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"];
    const sdl = sdlWith(env);
    const secrets = input.secrets ?? Object.fromEntries(referencedNamesIn(env).map(name => [name, randomUUID()]));

    await mockChain(address, sdl);

    if (input.record !== false) {
      const sealedSecrets = await container.resolve(ExecutionContextService).runWithContext(async () => {
        container.resolve(AuthService).currentUser = user;

        return await container.resolve(SdlSecretsService).sealForStorage({ userId: user.id, dseq: DSEQ, secrets });
      });

      const manifestVersion = await recordedVersionFor(sdl, secrets);
      await container.resolve(ExecutionContextService).runWithContext(async () => {
        container.resolve(ExecutionContextService).set("ORGANIZATION_CONTEXT", createOrganizationContext({ organizationId, organizationType: "personal" }));

        await deploymentSettingRepository.upsertDefinition({ userId: user.id, dseq: DSEQ, sdl, manifestVersion, sealedSecrets });
      });
    } else {
      await deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq: DSEQ, organizationId });
    }

    kmsClient.asymmetricDecrypt.mockClear();

    return { user, apiKey, address, sdl, secrets };
  }
});
