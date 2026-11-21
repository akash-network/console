import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import nock from "nock";
import { randomUUID } from "node:crypto";
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
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
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

const { client: kmsClient } = registerFakeSdlSecretsKms();

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

describe("Checking a deployment definition", () => {
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

  describe("POST /v1/deployments/validate", () => {
    it("answers valid for a definition a create would take", async () => {
      const { apiKey } = await setup({ record: false });

      const response = await check(apiKey, { sdl: sdlWith(["MODE=production"]), secretEnv: [] });

      expect(response.status).toBe(200);
      expect(await resultOf(response)).toEqual({ valid: true, errors: [], keptSecrets: [] });
    });

    it("reports every error at once, each at its path", async () => {
      const { apiKey } = await setup({ record: false });
      const sdl = sdlWith(["MODE=ac-oops", "API_KEY=ac-secret://API_KEY"]).replace("    image: nginx\n", "");

      const response = await check(apiKey, { sdl, secretEnv: ["MISSPELT"] });

      const result = await resultOf(response);
      expect(response.status).toBe(200);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/services/web/env/0", keyword: "sdl-reference" }),
          expect.objectContaining({ path: "/services/web/env/1", message: expect.stringContaining("ac-secret://API_KEY") }),
          expect.objectContaining({ path: "/secretEnv", message: expect.stringContaining("MISSPELT") }),
          expect.objectContaining({ path: expect.stringContaining("/services/web") })
        ])
      );
    });

    it("checks a definition sent as JSON", async () => {
      const { apiKey } = await setup({ record: false });

      const response = await check(apiKey, { definition: yaml.raw<SDLInput>(sdlWith(["MODE=production"])), secretEnv: [] });

      expect(await resultOf(response)).toMatchObject({ valid: true });
    });

    it("creates, records and broadcasts nothing", async () => {
      const { apiKey, user } = await setup({ record: false });
      const before = await settingOf(user);

      await check(apiKey, { sdl: sdlWith(["MODE=production"]) });

      expect(await settingOf(user)).toEqual(before);
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("refuses a request carrying neither spelling of the document", async () => {
      const { apiKey } = await setup({ record: false });

      const response = await check(apiKey, { secretEnv: [] });

      expect(response.status).toBe(400);
    });

    it("rejects an unauthenticated request", async () => {
      const response = await app.request("/v1/deployments/validate", {
        method: "POST",
        body: JSON.stringify({ data: { sdl: sdlWith([]) } }),
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });
  });

  describe("POST /v1/deployments/{dseq}/definition/validate", () => {
    it("lists the references that would keep the value the deployment stores", async () => {
      const { apiKey } = await setup();

      const response = await check(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { image: "nginx:1.27" }) }, DSEQ);

      expect(await resultOf(response)).toEqual({ valid: true, errors: [], keptSecrets: ["s0_e0", "s0_e1"] });
    });

    it("reports a change only a new deployment can take", async () => {
      const { apiKey } = await setup();

      const response = await check(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"], { cpu: 0.5 }) }, DSEQ);

      expect((await resultOf(response)).errors).toEqual([expect.objectContaining({ keyword: "deployment_resources_changed" })]);
    });

    it("reports a reference with neither a new value nor a stored one", async () => {
      const { apiKey } = await setup();

      const response = await check(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0", "NEW_KEY=ac-secret://NEW_KEY"]) }, DSEQ);

      expect(await resultOf(response)).toMatchObject({
        valid: false,
        errors: [expect.objectContaining({ path: "/services/web/env/1", keyword: "sdl-reference" })],
        keptSecrets: ["s0_e0"]
      });
    });

    it("records, seals and sends nothing", async () => {
      const { apiKey, user } = await setup();
      const before = await settingOf(user);

      await check(apiKey, { sdl: sdlWith(["API_TOKEN=ac-secret://s0_e0"], { image: "nginx:1.27" }) }, DSEQ);

      expect(await settingOf(user)).toEqual(before);
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("answers 404 for a deployment the console recorded no sdl for", async () => {
      const { apiKey } = await setup({ record: false });

      const response = await check(apiKey, { sdl: sdlWith(["MODE=production"]) }, DSEQ);

      expect(response.status).toBe(404);
    });
  });

  async function recordedVersionFor(sdl: string, secrets: Record<string, string>) {
    const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });

    return resolved.ok ? Buffer.from(resolved.value.manifestVersion).toString("base64") : Buffer.from("unresolvable-fixture").toString("base64");
  }

  function check(apiKey: string, data: Record<string, unknown>, dseq?: string) {
    return app.request(dseq ? `/v1/deployments/${dseq}/definition/validate` : "/v1/deployments/validate", {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function resultOf(response: Response) {
    const { data } = (await response.json()) as { data: { valid: boolean; errors: Array<{ path: string; keyword: string; message: string }>; keptSecrets: string[] } };

    return data;
  }

  async function settingOf(user: UserOutput) {
    return await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: DSEQ });
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
