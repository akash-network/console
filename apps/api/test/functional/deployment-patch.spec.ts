import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, manifestToSortedJSON, yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { CompactEncrypt } from "jose";
import nock from "nock";
import { randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
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
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const { client: kmsClient, publicKey } = registerFakeSdlSecretsKms();

const DSEQ = "1234";

function storedSdl(env: string[], image = "nginx") {
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

describe("PATCH /v1/deployments/{dseq}", () => {
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
    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue({
      findByUserId: async (id: string) => knownWallets[id],
      findOneByUserId: async (id: string) => knownWallets[id][0]
    } as unknown as UserWalletRepository);
    vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(createLeaseStatus());
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue(mock());
    kmsClient.asymmetricDecrypt.mockClear();
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

  it("leaves every other name opening to its original plaintext when one value is replaced", async () => {
    const secrets = { s0_e0: randomUUID(), s0_e1: `postgres://app:${randomUUID()}@db.internal/app` };
    const { apiKey, user } = await patchable({ secrets });
    const rotated = randomUUID();

    const response = await patch(apiKey, { services: { web: {} } }, { s0_e0: rotated });

    expect(response.status).toBe(200);
    await expect(openStored(user)).resolves.toEqual({ s0_e0: rotated, s0_e1: secrets.s0_e1 });
  });

  it("leaves every other name resolvable when a patched variable moves and is renamed", async () => {
    const secrets = { s0_e0: randomUUID(), s0_e1: randomUUID() };
    const { apiKey, user } = await patchable({ secrets });
    const rotated = randomUUID();

    const response = await patch(apiKey, { services: { web: { env: { API_TOKEN: rotated } } } });

    expect(response.status).toBe(200);
    const stored = await openStored(user);
    expect(Object.values(stored)).toEqual(expect.arrayContaining([rotated, secrets.s0_e1]));
    const setting = await settingOf(user);
    expect((await container.resolve(SdlService).generateResolvedManifest({ sdl: setting!.sdl!, secrets: stored })).ok).toBe(true);
  });

  it("drops the name a moved variable used to be stored under", async () => {
    const { apiKey, user } = await patchable({ secrets: { s0_e0: randomUUID(), s0_e1: randomUUID() } });

    await patch(apiKey, { services: { web: { env: { API_TOKEN: randomUUID() } } } });

    expect(Object.keys(await openStored(user))).not.toContain("s0_e0");
  });

  it("keeps every stored value resolvable when the sdl changes and no secrets are supplied", async () => {
    const secrets = { s0_e0: randomUUID(), s0_e1: randomUUID() };
    const { apiKey, user } = await patchable({ secrets });

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(200);
    const setting = await settingOf(user);
    expect(setting?.sdl).toContain("nginx:1.27");
    await expect(openStored(user)).resolves.toEqual(secrets);
    expect((await container.resolve(SdlService).generateResolvedManifest({ sdl: setting!.sdl!, secrets })).ok).toBe(true);
  });

  it("drops a name from the re-sealed token once the sdl stops referencing it", async () => {
    const secrets = { s0_e0: randomUUID(), s0_e1: randomUUID() };
    const { apiKey, user } = await patchable({ secrets });

    const response = await patch(apiKey, { services: { web: { env: { DATABASE_URL: null } } } });

    expect(response.status).toBe(200);
    await expect(openStored(user)).resolves.toEqual({ s0_e0: secrets.s0_e0 });
  });

  describe("a reference with no value anywhere", () => {
    it("fails with a 4xx naming it", async () => {
      const { apiKey } = await patchable({ secrets: { s0_e0: randomUUID() }, env: ["API_TOKEN=ac-secret://s0_e0", "ORPHAN=ac-secret://s0_e9"] });

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("ac-secret://s0_e9");
    });

    it("persists nothing", async () => {
      const { apiKey, user } = await patchable({
        secrets: { s0_e0: randomUUID() },
        env: ["API_TOKEN=ac-secret://s0_e0", "ORPHAN=ac-secret://s0_e9"]
      });
      const before = await settingOf(user);

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(await settingOf(user)).toMatchObject({
        sdl: before!.sdl,
        manifestVersion: before!.manifestVersion,
        sealedSecrets: before!.sealedSecrets
      });
    });
  });

  describe("a stored token something has tampered with", () => {
    it("fails with the permanent error rather than a retryable one", async () => {
      const { apiKey, user } = await patchable();
      await flipFirstCiphertextCharacterOfToken(user);

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({ message: "Unable to read stored secrets", code: "stored_secrets_unreadable" });
    });

    it("still refuses when every value is supplied fresh, the case where overwriting could have succeeded", async () => {
      const { apiKey, user } = await patchable();
      const tampered = await flipFirstCiphertextCharacterOfToken(user);

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, { s0_e0: randomUUID(), s0_e1: randomUUID() });

      expect(response.status).toBe(500);
      expect((await settingOf(user))?.sealedSecrets).toBe(tampered);
    });

    it("leaves the row intact, tampered token and all", async () => {
      const { apiKey, user } = await patchable();
      const tampered = await flipFirstCiphertextCharacterOfToken(user);
      const before = await settingOf(user);

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(await settingOf(user)).toMatchObject({
        sdl: before!.sdl,
        manifestVersion: before!.manifestVersion,
        sealedSecrets: tampered
      });
    });
  });

  it("sends a lease provider a manifest reflecting both the new sdl and the new value", async () => {
    const { apiKey } = await patchable({ secrets: { s0_e0: randomUUID(), s0_e1: randomUUID() } });
    const rotated = randomUUID();
    const kept = randomUUID();
    await patch(apiKey, { services: { web: { env: { DATABASE_URL: kept } } } });
    vi.mocked(providerService.sendManifest).mockClear();

    await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, { s0_e0: rotated });

    const expected = await manifestOf(storedSdl([`API_TOKEN=${rotated}`, `DATABASE_URL=${kept}`], "nginx:1.27"));
    expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: expected }));
  });

  describe("what it spends on the key service", () => {
    it("unwraps once for a patch that changes twelve secrets and supplies none", async () => {
      const env = Array.from({ length: 12 }, (_, index) => `VAR_${index}=ac-secret://s0_e${index}`);
      const secrets = Object.fromEntries(env.map((_, index) => [`s0_e${index}`, randomUUID()]));
      const { apiKey } = await patchable({ secrets, env });

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
    });

    it("unwraps the seal and the data key once each when a patch supplies values", async () => {
      const env = Array.from({ length: 12 }, (_, index) => `VAR_${index}=ac-secret://s0_e${index}`);
      const secrets = Object.fromEntries(env.map((_, index) => [`s0_e${index}`, randomUUID()]));
      const { apiKey } = await patchable({ secrets, env });
      const supplied = Object.fromEntries(env.map((_, index) => [`s0_e${index}`, randomUUID()]));

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, supplied);

      expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
    });
  });

  describe("where the sdl comes from", () => {
    it("ignores an sdl the request tries to carry", async () => {
      const { apiKey, user } = await patchable();

      const response = await request(apiKey, {
        services: { web: { image: "nginx:1.27" } },
        sdl: storedSdl(["INJECTED=ac-secret://s0_e0"], "attacker/image")
      });

      expect(response.status).toBe(200);
      const stored = (await settingOf(user))!.sdl!;
      expect(stored).toContain("API_TOKEN");
      expect(stored).toContain("DATABASE_URL");
      expect(stored).not.toContain("INJECTED");
      expect(stored).not.toContain("attacker/image");
    });

    it("answers 404 for a deployment the console recorded no sdl for", async () => {
      const { apiKey } = await patchable({ record: false });

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(404);
    });
  });

  describe("the version a patch expects", () => {
    it("applies the patch when the expected version is still current", async () => {
      const { apiKey, user } = await patchable();
      const current = (await settingOf(user))!.manifestVersion!;

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } }, ifManifestVersion: current });

      expect(response.status).toBe(200);
    });

    it("answers 409 and persists nothing when the deployment has moved on", async () => {
      const { apiKey, user } = await patchable();
      const before = await settingOf(user);

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } }, ifManifestVersion: "AAAAmovedon" });

      expect(response.status).toBe(409);
      expect(await settingOf(user)).toMatchObject({
        sdl: before!.sdl,
        manifestVersion: before!.manifestVersion,
        sealedSecrets: before!.sealedSecrets
      });
    });
  });

  describe("a key the deployment does not have", () => {
    it("answers 400 naming a service the sdl does not declare", async () => {
      const { apiKey } = await patchable();

      const response = await patch(apiKey, { services: { api: { image: "nginx" } } });

      expect(response.status).toBe(400);
      expect(((await response.json()) as { message: string }).message).toContain("is not a service of this deployment");
    });

    it("answers 400 naming a port the service does not expose", async () => {
      const { apiKey } = await patchable();

      const response = await patch(apiKey, { services: { web: { expose: { "8080": { accept: ["x.test"] } } } } });

      expect(response.status).toBe(400);
      expect(((await response.json()) as { message: string }).message).toContain('exposes no port "8080"');
    });

    it("refuses a patch naming no services at all", async () => {
      const { apiKey } = await patchable();

      const response = await patch(apiKey, { services: {} });

      expect(response.status).toBe(400);
    });
  });

  describe("a plaintext value in a service the patch never named", () => {
    it("stays in the clear, readable to its owner", async () => {
      const { apiKey, user } = await patchable({ env: ["API_TOKEN=ac-secret://s0_e0", "LOG_LEVEL=debug"], secrets: { s0_e0: randomUUID() } });

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(200);
      expect((await settingOf(user))?.sdl).toContain("LOG_LEVEL=debug");
    });

    it("is not pulled into the sealed token", async () => {
      const token = randomUUID();
      const { apiKey, user } = await patchable({ env: ["API_TOKEN=ac-secret://s0_e0", "LOG_LEVEL=debug"], secrets: { s0_e0: token } });

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      await expect(openStored(user)).resolves.toEqual({ s0_e0: token });
    });

    it("is sealed once the patch does name it", async () => {
      const { apiKey, user } = await patchable({ env: ["API_TOKEN=ac-secret://s0_e0", "LOG_LEVEL=debug"], secrets: { s0_e0: randomUUID() } });

      const response = await patch(apiKey, { services: { web: { env: { LOG_LEVEL: "trace" } } } });

      expect(response.status).toBe(200);
      const setting = await settingOf(user);
      expect(setting?.sdl).not.toContain("LOG_LEVEL=trace");
      expect(Object.values(await openStored(user))).toContain("trace");
    });
  });

  describe("a supplied secret name the sdl does not reference", () => {
    it("answers 400 naming it rather than silently dropping it", async () => {
      const { apiKey } = await patchable();

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, { s0_eTYPO: randomUUID() });

      expect(response.status).toBe(400);
      expect(((await response.json()) as { message: string }).message).toContain("s0_eTYPO");
    });

    it("persists nothing", async () => {
      const { apiKey, user } = await patchable();
      const before = await settingOf(user);

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, { s0_eTYPO: randomUUID() });

      expect(await settingOf(user)).toMatchObject({
        sdl: before!.sdl,
        manifestVersion: before!.manifestVersion,
        sealedSecrets: before!.sealedSecrets
      });
    });
  });

  describe("http options over the wire", () => {
    it("accepts zero as a way to clear a timeout", async () => {
      const { apiKey, user } = await patchable();

      const response = await patch(apiKey, { services: { web: { expose: { "80": { httpOptions: { readTimeout: 0 } } } } } });

      expect(response.status).toBe(200);
      expect((await settingOf(user))?.sdl).toContain("read_timeout: 0");
    });

    it("refuses a negative timeout", async () => {
      const { apiKey } = await patchable();

      const response = await patch(apiKey, { services: { web: { expose: { "80": { httpOptions: { readTimeout: -1 } } } } } });

      expect(response.status).toBe(400);
    });

    it("adds no options node for a patch that assigns none", async () => {
      const { apiKey, user } = await patchable();

      const response = await patch(apiKey, { services: { web: { expose: { "80": { httpOptions: {} } } } } });

      expect(response.status).toBe(200);
      expect((await settingOf(user))?.sdl).not.toContain("http_options");
    });
  });

  describe("the size of the set it would store", () => {
    it("refuses a merged set past the count a deployment may carry", async () => {
      const { apiKey } = await patchable();
      capSecretCountAt(1);

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(400);
    });

    it("persists nothing when the merged set is refused", async () => {
      const { apiKey, user } = await patchable();
      const before = await settingOf(user);
      capSecretCountAt(1);

      await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(await settingOf(user)).toMatchObject({
        sdl: before!.sdl,
        manifestVersion: before!.manifestVersion,
        sealedSecrets: before!.sealedSecrets
      });
    });

    it("accepts a merged set exactly at the count", async () => {
      const { apiKey } = await patchable();
      capSecretCountAt(2);

      const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(200);
    });
  });

  it("refuses an expected manifest version longer than the column can hold", async () => {
    const { apiKey } = await patchable();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } }, ifManifestVersion: "A".repeat(65) });

    expect(response.status).toBe(400);
  });

  it("accepts an expected manifest version exactly at the column's bound", async () => {
    const { apiKey } = await patchable();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } }, ifManifestVersion: "A".repeat(64) });

    expect(response.status).toBe(409);
  });

  it("returns the manifest version it recorded", async () => {
    const { apiKey, user } = await patchable();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    const { data } = (await response.json()) as { data: { manifestVersion: string } };
    expect(data.manifestVersion).toBe((await settingOf(user))!.manifestVersion);
  });

  it("rejects an unauthenticated request", async () => {
    const response = await app.request(`/v1/deployments/${DSEQ}`, {
      method: "PATCH",
      body: JSON.stringify({ data: { services: { web: { image: "nginx" } } } }),
      headers: new Headers({ "Content-Type": "application/json" })
    });

    expect(response.status).toBe(401);
  });

  function capSecretCountAt(maxCount: number) {
    const config = container.resolve(DeploymentConfigService);
    const passThrough = config.get.bind(config);

    vi.spyOn(config, "get").mockImplementation((key: Parameters<typeof passThrough>[0]) => (key === "SDL_SECRETS_MAX_COUNT" ? maxCount : passThrough(key)));
  }

  async function manifestOf(sdl: string) {
    const manifest = generateManifest(yaml.raw<SDLInput>(sdl));
    expect(manifest.ok).toBe(true);

    return manifestToSortedJSON((manifest as Extract<typeof manifest, { ok: true }>).value.groups);
  }

  async function recordedVersionFor(sdl: string, secrets: Record<string, string>) {
    const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });

    return resolved.ok ? Buffer.from(resolved.value.manifestVersion).toString("base64") : Buffer.from("unresolvable-fixture").toString("base64");
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

  async function flipFirstCiphertextCharacterOfToken(user: UserOutput) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const table = resolveTable("DeploymentSettings");
    const setting = await settingOf(user);
    const segments = setting!.sealedSecrets!.split(".");
    segments[3] = `${segments[3][0] === "A" ? "B" : "A"}${segments[3].slice(1)}`;
    const tampered = segments.join(".");

    await db.update(table).set({ sealedSecrets: tampered }).where(eq(table.id, setting!.id));

    return tampered;
  }

  async function sealFor(user: UserOutput, secrets: Record<string, string>) {
    return await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(secrets)))
      .setProtectedHeader({
        alg: SDL_SECRETS_SEAL_ALGORITHM,
        enc: SDL_SECRETS_CONTENT_ENCRYPTION,
        kid: SDL_SECRETS_KID,
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 300
      })
      .encrypt(publicKey);
  }

  function patch(apiKey: string, data: Record<string, unknown>, secrets?: Record<string, string>) {
    return request(apiKey, data, secrets);
  }

  async function request(apiKey: string, data: Record<string, unknown>, secrets?: Record<string, string>) {
    const user = knownUsers[knownApiKeys[apiKey].userId];
    const sealedSecrets = secrets ? await sealFor(user, secrets) : undefined;

    return await app.request(`/v1/deployments/${DSEQ}`, {
      method: "PATCH",
      body: JSON.stringify({ data: { ...data, sealedSecrets } }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  function referencedNamesIn(env: string[]) {
    return env.flatMap(entry => entry.match(/ac-secret:\/\/([A-Za-z_][A-Za-z0-9_]*)/)?.slice(1) ?? []);
  }

  async function patchable(input: { secrets?: Record<string, string>; env?: string[]; record?: boolean } = {}) {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const apiKey = faker.string.alphanumeric(24);
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });
    const address = createAkashAddress();

    knownUsers[dbUser.id] = user;
    knownApiKeys[apiKey] = createApiKey({ userId: dbUser.id });
    knownWallets[dbUser.id] = [createUserWallet({ userId: dbUser.id, address })];

    const env = input.env ?? ["API_TOKEN=ac-secret://s0_e0", "DATABASE_URL=ac-secret://s0_e1"];
    const sdl = storedSdl(env);
    const secrets = input.secrets ?? Object.fromEntries(referencedNamesIn(env).map(name => [name, randomUUID()]));

    await mockChain(address);

    if (input.record !== false) {
      const sealedSecrets = await container.resolve(ExecutionContextService).runWithContext(async () => {
        container.resolve(AuthService).currentUser = user;

        return await container.resolve(SdlSecretsService).sealForStorage({ userId: user.id, dseq: DSEQ, secrets });
      });

      await deploymentSettingRepository.upsertDefinition({
        userId: user.id,
        dseq: DSEQ,
        sdl,
        manifestVersion: await recordedVersionFor(sdl, secrets),
        sealedSecrets
      });
    } else {
      await deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq: DSEQ });
    }

    kmsClient.asymmetricDecrypt.mockClear();

    return { user, apiKey, address, sdl, secrets };
  }

  async function mockChain(address: string) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const info = createDeploymentInfoSeed({ owner: address, dseq: DSEQ });
    const leases = createManyLeaseApiResponses(1, { owner: address, dseq: DSEQ, state: "active" });

    nock(restUrl).persist().get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${address}&id.dseq=${DSEQ}`).reply(200, info);
    nock(restUrl).persist().get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}`).reply(200, { leases });
    nock(restUrl)
      .persist()
      .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${address}&filters.dseq=${DSEQ}&pagination.limit=1000`)
      .reply(200, { leases });

    await createDeployment({ owner: address, dseq: DSEQ });
  }
});
