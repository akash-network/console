import { faker } from "@faker-js/faker";
import { CompactEncrypt } from "jose";
import nock from "nock";
import { randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import { MAX_RUNTIME_LIMIT_HOURS, MAX_RUNTIME_LIMIT_INCREMENT_HOURS } from "@src/deployment/http-schemas/runtime-limit";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";

import { registerFakeSdlSecretsKms, SDL_SECRETS_KID, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const MAX_COUNT = 100;

const { client: kmsClient, publicKey } = registerFakeSdlSecretsKms();

function sdlWith(env: string[]) {
  const body = `  web:\n    image: nginx\n    env:\n${env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("")}`;

  return `version: "2.0"\nservices:\n${body}profiles:\n  compute:\n    web:\n      resources:\n        cpu:\n          units: 0.1\n        memory:\n          size: 128Mi\n        storage:\n          - size: 128Mi\n  placement:\n    dcloud:\n      pricing:\n        web:\n          denom: uakt\n          amount: 1000\ndeployment:\n  web:\n    dcloud:\n      profile: web\n      count: 1\n`;
}

describe("Deployment redeploy", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyAuthService = container.resolve(ApiKeyAuthService);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const blockHttpService = container.resolve(BlockHttpService);
  const signerService = container.resolve(ManagedSignerService);
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

  describe("a source whose stored sdl is already all references", () => {
    it("records an sdl byte-identical to the source's", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect(response.status).toBe(201);
      expect((await settingOf(user, response))!.sdl).toBe(source.setting.sdl);
    });

    it("opens its token to exactly the source's plaintexts", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID(), DATABASE_URL: `postgres://a:${randomUUID()}@db/app` });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      const setting = await settingOf(user, response);
      await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual(source.secrets);
    });

    it("binds the new token to the new deployment, leaving the source's unopenable under it", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      const setting = await settingOf(user, response);
      expect(setting!.dseq).not.toBe(source.setting.dseq);
      await expect(openStoredToken(user, setting!.dseq, source.setting.sealedSecrets!)).rejects.toMatchObject({ status: 500 });
    });
  });

  describe("a source whose stored sdl still carries values in the clear", () => {
    it("seals what the source left in the clear rather than recording an identical sdl", async () => {
      const { apiKey, user } = await persistedUser();
      const plain = randomUUID();
      const sealed = randomUUID();
      const source = await sourceFromSeal(apiKey, user, { API_TOKEN: sealed }, [`LOG_LEVEL=${plain}`]);

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      expect(setting!.sdl).not.toBe(source.setting.sdl);
      expect(setting!.sdl).not.toContain(plain);
    });

    it("loses none of the source's values in doing so", async () => {
      const { apiKey, user } = await persistedUser();
      const plain = randomUUID();
      const sealed = randomUUID();
      const source = await sourceFromSeal(apiKey, user, { API_TOKEN: sealed }, [`LOG_LEVEL=${plain}`]);

      const response = await postRedeploy(apiKey, source.setting.dseq);

      const setting = await settingOf(user, response);
      const opened = await openStoredToken(user, setting!.dseq, setting!.sealedSecrets!);
      expect(Object.values(opened)).toEqual(expect.arrayContaining([sealed, plain]));
    });

    it("settles after one redeploy, the next one deriving nothing further", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromSeal(apiKey, user, { API_TOKEN: randomUUID() }, [`LOG_LEVEL=${randomUUID()}`]);
      const first = await settingOf(user, await postRedeploy(apiKey, source.setting.dseq));

      const second = await settingOf(user, await postRedeploy(apiKey, first!.dseq));

      expect(second!.sdl).toBe(first!.sdl);
      await expect(openStoredToken(user, second!.dseq, second!.sealedSecrets!)).resolves.toEqual(
        await openStoredToken(user, first!.dseq, first!.sealedSecrets!)
      );
    });
  });

  describe("the runtime limit", () => {
    it("carries the source's forward", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() }, 5);

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect((await settingOf(user, response))!.runtimeLimitHours).toBe(5);
    });

    it("reduces one longer than a single request may grant to that increment", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() }, 5);
      await deploymentSettingRepository.updateById(source.setting.id, { runtimeLimitHours: MAX_RUNTIME_LIMIT_HOURS });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect((await settingOf(user, response))!.runtimeLimitHours).toBe(MAX_RUNTIME_LIMIT_INCREMENT_HOURS);
    });

    it("carries none forward when the source has none", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect((await settingOf(user, response))!.runtimeLimitHours).toBeNull();
    });

    it("prefers an explicitly supplied one", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() }, 5);

      const response = await postRedeploy(apiKey, source.setting.dseq, { runtimeLimitHours: 9 });

      expect((await settingOf(user, response))!.runtimeLimitHours).toBe(9);
    });
  });

  it("prefers a supplied secret to the source's value of the same name", async () => {
    const { apiKey, user } = await persistedUser();
    const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID(), DATABASE_URL: `postgres://a:${randomUUID()}@old/app` });
    const replaced = `postgres://a:${randomUUID()}@new/app`;
    const [, databaseUrlName] = Object.keys(source.secrets);

    const response = await postRedeploy(apiKey, source.setting.dseq, { secrets: { [databaseUrlName]: replaced } });

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    const opened = await openStoredToken(user, setting!.dseq, setting!.sealedSecrets!);
    expect(opened[databaseUrlName]).toBe(replaced);
    expect(Object.values(opened)).not.toContain(source.secrets[databaseUrlName]);
  });

  it("redeploys a closed deployment, closing one deliberately keeping its secrets", async () => {
    const { apiKey, user } = await persistedUser();
    const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() });
    await deploymentSettingRepository.updateById(source.setting.id, { closed: true });

    const response = await postRedeploy(apiKey, source.setting.dseq);

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual(source.secrets);
  });

  it("redeploys a source holding exactly as many secrets as a deployment may carry", async () => {
    const { apiKey, user } = await persistedUser();
    const values = Object.fromEntries(Array.from({ length: MAX_COUNT }, (_, index) => [`SETTING_${index}`, randomUUID()]));
    const source = await sourceFromPlaintext(apiKey, user, values);
    expect(Object.keys(source.secrets)).toHaveLength(MAX_COUNT);

    const response = await postRedeploy(apiKey, source.setting.dseq);

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual(source.secrets);
  });

  it("refuses a source holding one more secret than a deployment may carry", async () => {
    const { apiKey, user } = await persistedUser();
    const values = Object.fromEntries(Array.from({ length: MAX_COUNT + 1 }, (_, index) => [`SETTING_${index}`, randomUUID()]));
    const source = await sourceFromPlaintext(apiKey, user, values);

    const response = await postRedeploy(apiKey, source.setting.dseq);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(`At most ${MAX_COUNT} secrets may be carried by one deployment`);
  });

  describe("a source the caller may not redeploy", () => {
    it("answers not found for another user's deployment, recording nothing and broadcasting nothing", async () => {
      const owner = await persistedUser();
      const other = await persistedUser();
      const source = await sourceFromPlaintext(owner.apiKey, owner.user, { API_TOKEN: randomUUID() });

      const response = await postRedeploy(other.apiKey, source.setting.dseq);

      expect(response.status).toBe(404);
      expect(await deploymentSettingRepository.count({ userId: other.user.id })).toBe(0);
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it("answers not found for a deployment the console recorded no sdl for", async () => {
      const { apiKey, user } = await persistedUser();
      const dseq = Date.now().toString();
      await deploymentSettingRepository.createDefaultIfMissing({ userId: user.id, dseq });

      const response = await postRedeploy(apiKey, dseq);

      expect(response.status).toBe(404);
      expect(await response.text()).toContain("nothing to redeploy");
    });

    it("refuses a source whose sdl references values its row no longer holds", async () => {
      const { apiKey, user } = await persistedUser();
      const source = await sourceFromPlaintext(apiKey, user, { API_TOKEN: randomUUID() });
      await deploymentSettingRepository.updateById(source.setting.id, { sealedSecrets: null });

      const response = await postRedeploy(apiKey, source.setting.dseq);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain("no value supplied for SDL Reference");
    });
  });

  async function openStoredToken(user: UserOutput, dseq: string, sealedSecrets: string) {
    const executionContextService = container.resolve(ExecutionContextService);
    const authService = container.resolve(AuthService);

    return await executionContextService.runWithContext(async () => {
      authService.currentUser = user;

      return await container.resolve(SdlSecretsService).openStored({ userId: user.id, dseq, sealedSecrets });
    });
  }

  async function settingOf(user: UserOutput, response: Response) {
    const { data } = (await response.clone().json()) as { data: { dseq: string } };

    return await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: data.dseq });
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

  /** Sealing nothing leaves the console to derive every value, so the stored sdl comes back fully de-referenced. */
  async function sourceFromPlaintext(apiKey: string, user: UserOutput, values: Record<string, string>, runtimeLimitHours?: number) {
    const response = await postCreate(apiKey, {
      sdl: sdlWith(Object.entries(values).map(([name, value]) => `${name}=${value}`)),
      runtimeLimitHours
    });

    expect(response.status).toBe(201);
    const setting = (await settingOf(user, response))!;

    return { setting, secrets: await openStoredToken(user, setting.dseq, setting.sealedSecrets!) };
  }

  /** A seal says which values are secret, so the console leaves every other one in the clear in the stored sdl. */
  async function sourceFromSeal(apiKey: string, user: UserOutput, secrets: Record<string, string>, plaintextEnv: string[]) {
    const response = await postCreate(apiKey, {
      sdl: sdlWith([...Object.keys(secrets).map(name => `${name}=ac-secret://${name}`), ...plaintextEnv]),
      sealedSecrets: await sealFor(user, secrets)
    });

    expect(response.status).toBe(201);

    return { setting: (await settingOf(user, response))! };
  }

  async function postCreate(apiKey: string, data: Record<string, unknown>) {
    return await app.request("/v1/deployments", {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function postRedeploy(apiKey: string, dseq: string, options?: { runtimeLimitHours?: number; secrets?: Record<string, string> }) {
    const user = knownUsers[knownApiKeys[apiKey].userId];
    const data: Record<string, unknown> = {};

    if (options?.runtimeLimitHours !== undefined) data.runtimeLimitHours = options.runtimeLimitHours;
    if (options?.secrets) data.sealedSecrets = await sealFor(user, options.secrets);

    return await app.request(`/v1/deployments/${dseq}/redeploy`, {
      method: "POST",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function persistedUser() {
    const dbUser = await userRepository.create({ userId: faker.string.uuid() });
    const apiKey = faker.string.alphanumeric(24);
    const user = createUser({ id: dbUser.id, userId: dbUser.userId ?? undefined });

    knownUsers[dbUser.id] = user;
    knownApiKeys[apiKey] = createApiKey({ userId: dbUser.id });
    knownWallets[dbUser.id] = [createUserWallet({ userId: dbUser.id, address: "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm" })];

    return { user, apiKey };
  }
});
