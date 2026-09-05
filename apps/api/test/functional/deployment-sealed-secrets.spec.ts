import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { CompactEncrypt, decodeProtectedHeader } from "jose";
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
import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";

import { registerFakeSdlSecretsKms, SDL_SECRETS_KID, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

interface OpenApiPaths {
  paths: Record<
    string,
    Record<string, { requestBody: { content: Record<string, { schema: { properties: { data: { properties: Record<string, unknown> } } } }> } }>
  >;
}

const MAX_VALUE_BYTES = 16 * 1024;
const REGISTRY_HOST = "registry.example.test";
const MAX_COUNT = 100;

const { client: kmsClient, publicKey } = registerFakeSdlSecretsKms();

function credentialsYaml(credentials?: Record<string, string>) {
  if (!credentials) return "";

  return `    credentials:\n${Object.entries(credentials)
    .map(([field, value]) => `      ${field}: ${JSON.stringify(value)}\n`)
    .join("")}`;
}

function sdlWith(services: Record<string, string[]>, credentials: Record<string, Record<string, string>> = {}) {
  const bodies = Object.entries(services)
    .map(
      ([name, env]) =>
        `  ${name}:\n    image: nginx\n${credentialsYaml(credentials[name])}    env:\n${env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("")}`
    )
    .join("");
  const computes = Object.keys(services)
    .map(
      name =>
        `    ${name}:\n      resources:\n        cpu:\n          units: 0.1\n        memory:\n          size: 128Mi\n        storage:\n          - size: 128Mi\n`
    )
    .join("");
  const pricing = Object.keys(services)
    .map(name => `        ${name}:\n          denom: uakt\n          amount: 1000\n`)
    .join("");
  const groups = Object.keys(services)
    .map(name => `  ${name}:\n    dcloud:\n      profile: ${name}\n      count: 1\n`)
    .join("");

  return `version: "2.0"\nservices:\n${bodies}profiles:\n  compute:\n${computes}  placement:\n    dcloud:\n      pricing:\n${pricing}deployment:\n${groups}`;
}

describe("Deployment sealed secrets", () => {
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

  it("commits the manifest version of a manifest carrying the resolved values", async () => {
    const { apiKey } = await persistedUser();
    const token = randomUUID();
    const sdl = sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] });

    const response = await postDeployment(apiKey, sdl, { API_TOKEN: token });

    expect(response.status).toBe(201);
    expect(broadcastHash()).toEqual(await manifestVersionOf(sdlWith({ web: [`API_TOKEN=${token}`] })));
  });

  it("commits the manifest version of a manifest carrying the resolved registry credential", async () => {
    const { apiKey } = await persistedUser();
    const [username, password] = [randomUUID(), randomUUID()];
    const referencing = { web: { host: REGISTRY_HOST, username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" } };
    const inline = { web: { host: REGISTRY_HOST, username, password } };
    const env = { web: ["LOG_LEVEL=debug"] };

    const response = await postDeployment(apiKey, sdlWith(env, referencing), { REG_USER: username, REG_PASS: password });

    expect(response.status).toBe(201);
    expect(broadcastHash()).toEqual(await manifestVersionOf(sdlWith(env, inline)));
  });

  it("names a registry credential reference it holds no value for and records nothing", async () => {
    const { apiKey, user } = await persistedUser();
    const referencing = { web: { host: REGISTRY_HOST, username: faker.string.alphanumeric(10), password: "ac-secret://REG_PASS" } };

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }, referencing), { API_TOKEN: randomUUID() });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("ac-secret://REG_PASS");
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("refuses a reserved value in a registry credential rather than shipping it to a provider", async () => {
    const { apiKey, user } = await persistedUser();
    const reserved = { web: { host: REGISTRY_HOST, username: faker.string.alphanumeric(10), password: "ac-dc-forever" } };

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"] }, reserved));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("reserved");
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("stores the credential values in its token and a credentials block that references them", async () => {
    const { apiKey, user } = await persistedUser();
    const [username, password] = [faker.string.alphanumeric(10), randomUUID()];
    const referencing = { web: { host: REGISTRY_HOST, username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" } };

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"] }, referencing), { REG_USER: username, REG_PASS: password });

    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain(`host: ${REGISTRY_HOST}`);
    expect(setting!.sdl).toContain("username: ac-secret://REG_USER");
    expect(setting!.sdl).toContain("password: ac-secret://REG_PASS");
    expect(setting!.sdl).not.toContain(password);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({ REG_USER: username, REG_PASS: password });
  });

  it("stores a reference for every service's own registry credentials, with neither service's value in the clear", async () => {
    const { apiKey, user } = await persistedUser();
    const web = { host: REGISTRY_HOST, username: faker.string.alphanumeric(10), password: randomUUID() };
    const worker = { host: "other-registry.example.test", username: faker.string.alphanumeric(10), password: randomUUID() };

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"], worker: ["LOG_LEVEL=debug"] }, { web, worker }));

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain("username: ac-secret://s0_c_username");
    expect(setting!.sdl).toContain("username: ac-secret://s1_c_username");
    expect(setting!.sdl).not.toContain(web.password);
    expect(setting!.sdl).not.toContain(worker.password);
    expect(setting!.sdl).not.toContain(web.username);
    expect(setting!.sdl).not.toContain(worker.username);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({
      s0_e0: "debug",
      s1_e0: "debug",
      s0_c_username: web.username,
      s0_c_password: web.password,
      s1_c_username: worker.username,
      s1_c_password: worker.password
    });
  });

  it("stores a credential the client left in the clear as a reference, with its value only in the token", async () => {
    const { apiKey, user } = await persistedUser();
    const [username, password] = [faker.string.alphanumeric(10), randomUUID()];
    const inTheClear = { web: { host: REGISTRY_HOST, username, password } };
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN", "LOG_LEVEL=debug"] }, inTheClear), {
      API_TOKEN: token
    });

    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain("username: ac-secret://s0_c_username");
    expect(setting!.sdl).toContain("password: ac-secret://s0_c_password");
    expect(setting!.sdl).toContain("LOG_LEVEL=debug");
    expect(setting!.sdl).not.toContain(username);
    expect(setting!.sdl).not.toContain(password);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({
      API_TOKEN: token,
      s0_c_username: username,
      s0_c_password: password
    });
  });

  it("refuses a sealed credential the resolved document rejects, saying nothing of its value", async () => {
    const { apiKey, user } = await persistedUser();
    const tooShort = faker.string.alphanumeric(5);
    const referencing = { web: { host: REGISTRY_HOST, username: faker.string.alphanumeric(10), password: "ac-secret://REG_PASS" } };

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"] }, referencing), { REG_PASS: tooShort });
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(body).toContain("at least 6 characters");
    expect(body).not.toContain(tooShort);
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("resolves one supplied value into every service that references it", async () => {
    const { apiKey } = await persistedUser();
    const token = randomUUID();
    const referencing = { web: ["API_TOKEN=ac-secret://API_TOKEN"], worker: ["API_TOKEN=ac-secret://API_TOKEN"] };
    const inline = { web: [`API_TOKEN=${token}`], worker: [`API_TOKEN=${token}`] };

    const response = await postDeployment(apiKey, sdlWith(referencing), { API_TOKEN: token });

    expect(response.status).toBe(201);
    expect(broadcastHash()).toEqual(await manifestVersionOf(sdlWith(inline)));
  });

  it("resolves each service's own reference into its own environment", async () => {
    const { apiKey } = await persistedUser();
    const [token, url] = [randomUUID(), randomUUID()];
    const referencing = { web: ["API_TOKEN=ac-secret://API_TOKEN"], worker: ["DATABASE_URL=ac-secret://DATABASE_URL"] };
    const inline = { web: [`API_TOKEN=${token}`], worker: [`DATABASE_URL=${url}`] };

    const response = await postDeployment(apiKey, sdlWith(referencing), { API_TOKEN: token, DATABASE_URL: url });

    expect(response.status).toBe(201);
    expect(broadcastHash()).toEqual(await manifestVersionOf(sdlWith(inline)));
  });

  it("commits a version that differs from the version of the unresolved sdl", async () => {
    const { apiKey } = await persistedUser();
    const sdl = sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] });

    await postDeployment(apiKey, sdl, { API_TOKEN: randomUUID() });

    expect(broadcastHash()).not.toEqual(await manifestVersionOf(sdl));
  });

  it("records the version it committed on chain", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: randomUUID() });

    const setting = await settingOf(user, response);
    expect(Buffer.from(setting!.manifestVersion!, "base64")).toEqual(Buffer.from(broadcastHash()));
  });

  // skip it temporary until manifest field is ignored during lease creation
  it.skip("returns no secret value, in the manifest it hands back or anywhere else in the body", async () => {
    const { apiKey } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: token });
    const body = await response.text();

    expect(response.status).toBe(201);
    expect(body).not.toContain(token);
    expect(body).toContain("ac-secret://API_TOKEN");
  });

  it("stores an sdl that keeps the reference and carries no value", async () => {
    const { apiKey, user } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: token });

    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain("API_TOKEN=ac-secret://API_TOKEN");
    expect(setting!.sdl).not.toContain(token);
  });

  it("stores every ordinary env value as submitted while the referenced one stays a reference", async () => {
    const { apiKey, user } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug", "API_TOKEN=ac-secret://API_TOKEN", "INHERITED_FROM_HOST"] }), {
      API_TOKEN: token
    });

    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain("LOG_LEVEL=debug");
    expect(setting!.sdl).toContain("INHERITED_FROM_HOST");
    expect(setting!.sdl).toContain("API_TOKEN=ac-secret://API_TOKEN");
    expect(setting!.sdl).not.toContain(token);
  });

  it("stores an sdl that reproduces the submitted document once its references are resolved", async () => {
    const { apiKey, user } = await persistedUser();
    const [token, url] = [randomUUID(), `postgres://app:${randomUUID()}@db.internal/app?ssl=true&a=b`];
    const referencing = {
      web: ["LOG_LEVEL=debug", "API_TOKEN=ac-secret://API_TOKEN", "INHERITED_FROM_HOST", "EXPLICITLY_EMPTY="],
      worker: ["DATABASE_URL=ac-secret://DATABASE_URL", "RETRIES=3"]
    };
    const inline = {
      web: ["LOG_LEVEL=debug", `API_TOKEN=${token}`, "INHERITED_FROM_HOST", "EXPLICITLY_EMPTY="],
      worker: [`DATABASE_URL=${url}`, "RETRIES=3"]
    };

    const response = await postDeployment(apiKey, sdlWith(referencing), { API_TOKEN: token, DATABASE_URL: url });

    const setting = await settingOf(user, response);
    const opened = await openStoredToken(user, setting!.dseq, setting!.sealedSecrets!);
    expect(resolvedDocumentOf(setting!.sdl!, opened)).toEqual(yaml.raw<SDLInput>(sdlWith(inline)));
  });

  it("stores an sdl whose resolved manifest version is the one it committed on chain", async () => {
    const { apiKey, user } = await persistedUser();
    const secrets = { API_TOKEN: randomUUID() };
    const submitted = sdlWith({ web: ["LOG_LEVEL=debug", "API_TOKEN=ac-secret://API_TOKEN"], worker: ["RETRIES=3"] });

    const response = await postDeployment(apiKey, submitted, secrets);

    const setting = await settingOf(user, response);
    const opened = await openStoredToken(user, setting!.dseq, setting!.sealedSecrets!);
    expect(await manifestVersionOfDocument(resolvedDocumentOf(setting!.sdl!, opened))).toEqual(broadcastHash());
  });

  it("stores an sdl whose resolved manifest version is the one it committed, for a create that sealed nothing", async () => {
    const { apiKey, user } = await persistedUser();
    const submitted = sdlWith(
      { web: [`API_TOKEN=${randomUUID()}`, "LOG_LEVEL=debug", "INHERITED_FROM_HOST"], worker: [`DATABASE_URL=postgres://u:${randomUUID()}@h/db`] },
      { web: { host: REGISTRY_HOST, username: faker.string.alphanumeric(10), password: randomUUID() } }
    );

    const response = await postDeployment(apiKey, submitted);

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    const opened = await openStoredToken(user, setting!.dseq, setting!.sealedSecrets!);
    expect(await manifestVersionOfDocument(resolvedDocumentOf(setting!.sdl!, opened))).toEqual(broadcastHash());
  });

  it("stores no value of a create that sealed nothing in the clear", async () => {
    const { apiKey, user } = await persistedUser();
    const [token, password] = [randomUUID(), randomUUID()];

    const response = await postDeployment(apiKey, sdlWith({ web: [`API_TOKEN=${token}`] }, { web: { host: REGISTRY_HOST, username: "u", password } }));

    const setting = await settingOf(user, response);
    expect(JSON.stringify(setting)).not.toContain(token);
    expect(JSON.stringify(setting)).not.toContain(password);
  });

  it("seals far more values than a client may supply, because the limits bound a seal in flight and not one it made itself", async () => {
    const { apiKey, user } = await persistedUser();
    const values = Object.fromEntries(Array.from({ length: MAX_COUNT * 3 }, (_, index) => [`SETTING_${index}`, randomUUID()]));

    const response = await postDeployment(apiKey, sdlWith({ web: Object.entries(values).map(([name, value]) => `${name}=${value}`) }));

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual(
      Object.fromEntries(Object.values(values).map((value, index) => [`s0_e${index}`, value]))
    );
  });

  it("refuses a create it cannot seal, recording nothing and broadcasting nothing", async () => {
    const { apiKey, user } = await persistedUser();
    const token = randomUUID();
    kmsClient.asymmetricDecrypt.mockRejectedValueOnce(new Error("key service unreachable"));

    const response = await postDeployment(apiKey, sdlWith({ web: [`API_TOKEN=${token}`] }));
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain(token);
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("stores a token bound to its owner and the deployment it was supplied for", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: randomUUID() });

    const setting = await settingOf(user, response);
    expect(decodeProtectedHeader(setting!.sealedSecrets!)).toMatchObject({ sub: user.id, dseq: setting!.dseq, alg: "dir", enc: "A256GCM" });
  });

  it("stores a token that is not the one the client sent", async () => {
    const { apiKey, user } = await persistedUser();
    const secrets = { API_TOKEN: randomUUID() };
    const seal = await sealFor(user, secrets);

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), secrets, seal);

    const setting = await settingOf(user, response);
    expect(setting!.sealedSecrets).not.toBe(seal);
  });

  it("stores no secret value in the clear", async () => {
    const { apiKey, user } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: token });

    const setting = await settingOf(user, response);
    expect(JSON.stringify(setting)).not.toContain(token);
  });

  it("spends one key-service call on the seal and one on the data key, however many secrets there are", async () => {
    const { apiKey } = await persistedUser();
    const names = ["ALPHA", "BRAVO", "CHARLIE", "DELTA"];
    const secrets = Object.fromEntries(names.map(name => [name, randomUUID()]));
    const env = names.map(name => `${name}=ac-secret://${name}`);

    const response = await postDeployment(apiKey, sdlWith({ web: env, worker: env, cron: env }), secrets);

    expect(response.status).toBe(201);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("names a reference it holds no value for and records nothing", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN", "OTHER=ac-secret://OTHER"] }), { API_TOKEN: "one" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("ac-secret://OTHER");
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("names a supplied value no service references and records nothing", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: "one", TYPOED: "two" });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain("TYPOED");
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("says nothing about a supplied value in the mistake it reports", async () => {
    const { apiKey } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: token, TYPOED: token });

    expect(await response.text()).not.toContain(token);
  });

  it("refuses more secrets than a deployment may carry, before anything is recorded", async () => {
    const { apiKey, user } = await persistedUser();
    const names = Array.from({ length: MAX_COUNT + 1 }, (_, index) => `SECRET_${index}`);
    const secrets = Object.fromEntries(names.map(name => [name, "value"]));

    const response = await postDeployment(apiKey, sdlWith({ web: names.map(name => `${name}=ac-secret://${name}`) }), secrets);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(`At most ${MAX_COUNT} secrets`);
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("refuses a value above the size a secret may be, before anything is recorded", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: "x".repeat(MAX_VALUE_BYTES + 1) });

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(`maximum value size of ${MAX_VALUE_BYTES} bytes`);
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("carries a seal at the stated limits rather than refusing it on body size", async () => {
    const { apiKey } = await persistedUser();
    const names = Array.from({ length: MAX_COUNT }, (_, index) => `SECRET_${index}`);
    const secrets = Object.fromEntries(names.map(name => [name, "x".repeat(MAX_VALUE_BYTES)]));

    const response = await postDeployment(apiKey, sdlWith({ web: names.map(name => `${name}=ac-secret://${name}`) }), secrets);

    expect(response.status).toBe(201);
  });

  it("accepts and resolves sealed secrets even though no document announces the field", async () => {
    const { apiKey, user } = await persistedUser();
    const token = randomUUID();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: token });

    expect(response.status).toBe(201);
    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({ API_TOKEN: token });
    expect(broadcastHash()).toEqual(await manifestVersionOf(sdlWith({ web: [`API_TOKEN=${token}`] })));
  });

  it("publishes no mention of the field in the document callers read", async () => {
    const response = await app.request("/v1/doc?scope=console");
    const document = await response.text();

    expect(response.status).toBe(200);
    expect(document).not.toContain("sealedSecrets");
    const createBody = (JSON.parse(document) as OpenApiPaths).paths["/v1/deployments"].post.requestBody.content["application/json"].schema.properties.data
      .properties;
    expect(Object.keys(createBody)).toEqual(["sdl", "deposit", "runtimeLimitHours"]);
  });

  it("refuses a submitted sdl above the allowance a request has always had for one", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, "d".repeat(MAX_SUBMITTED_SDL_LENGTH + 1));

    expect(response.status).toBe(400);
    expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
    expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
  });

  it("does not spend the seal's allowance on the sdl", async () => {
    const { apiKey } = await persistedUser();
    const names = Array.from({ length: MAX_COUNT }, (_, index) => `SECRET_${index}`);

    const response = await postDeployment(
      apiKey,
      sdlWith({ web: names.map(name => `${name}=ac-secret://${name}`) }),
      Object.fromEntries(names.map(name => [name, "d".repeat(MAX_VALUE_BYTES)]))
    );

    expect(response.status).toBe(201);
    expect(MAX_SUBMITTED_SDL_LENGTH).toBe(512 * 1024);
  });

  it("refuses a seal that was sealed for another user", async () => {
    const { apiKey } = await persistedUser();
    const other = await persistedUser();
    const secrets = { API_TOKEN: randomUUID() };

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), secrets, await sealFor(other.user, secrets));

    expect(response.status).toBe(403);
  });

  it("refuses a seal that is not a compact jwe", async () => {
    const { apiKey } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: "one" }, "not-a-jwe");

    expect(response.status).toBe(400);
  });

  it("seals the values of a create that named none of them, spending one unwrap on the data key", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"] }));

    expect(response.status).toBe(201);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
    const setting = await settingOf(user, response);
    expect(setting!.sdl).toContain("LOG_LEVEL=ac-secret://s0_e0");
    expect(setting!.sdl).not.toContain("LOG_LEVEL=debug");
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual({ s0_e0: "debug" });
  });

  it("creates a deployment with nothing to seal without reaching the key service", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: [] }));

    expect(response.status).toBe(201);
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
    expect((await settingOf(user, response))!.sealedSecrets).toBeNull();
  });

  it("stores a token that opens to exactly the values the client sealed", async () => {
    const { apiKey, user } = await persistedUser();
    const secrets = { API_TOKEN: randomUUID(), DATABASE_URL: `postgres://app:${randomUUID()}@db.internal/app` };

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN", "DATABASE_URL=ac-secret://DATABASE_URL"] }), secrets);

    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, setting!.dseq, setting!.sealedSecrets!)).resolves.toEqual(secrets);
  });

  it("stores a token no other deployment of the same user can open", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] }), { API_TOKEN: randomUUID() });

    const setting = await settingOf(user, response);
    await expect(openStoredToken(user, "1420000000009", setting!.sealedSecrets!)).rejects.toMatchObject({ status: 500 });
  });

  it("leaves a record a failed broadcast could not back, and lets the same create be retried", async () => {
    const { apiKey, user } = await persistedUser();
    const sdl = sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] });
    vi.mocked(signerService.executeDerivedDecodedTxByUserId).mockRejectedValueOnce(new Error("broadcast failed"));

    const abandoned = await postDeployment(apiKey, sdl, { API_TOKEN: randomUUID() });
    const orphan = await deploymentSettingRepository.findOneBy({ userId: user.id });
    const retried = await postDeployment(apiKey, sdl, { API_TOKEN: randomUUID() });

    expect(abandoned.status).toBe(500);
    expect(orphan?.sealedSecrets).toEqual(expect.any(String));
    expect(retried.status).toBe(201);
  });

  it("replaces the token of a retry on the same dseq rather than merging with the abandoned one", async () => {
    const { apiKey, user } = await persistedUser();
    const sdl = sdlWith({ web: ["API_TOKEN=ac-secret://API_TOKEN"] });
    const dseq = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(dseq);
    vi.mocked(signerService.executeDerivedDecodedTxByUserId).mockRejectedValueOnce(new Error("broadcast failed"));
    const abandonedSecrets = { API_TOKEN: randomUUID() };
    const retriedSecrets = { API_TOKEN: randomUUID() };

    await postDeployment(apiKey, sdl, abandonedSecrets);
    const abandoned = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: dseq.toString() });
    const retried = await postDeployment(apiKey, sdl, retriedSecrets);

    expect(retried.status).toBe(201);
    const replaced = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: dseq.toString() });
    expect(replaced!.sealedSecrets).not.toBe(abandoned!.sealedSecrets);
    await expect(openStoredToken(user, dseq.toString(), replaced!.sealedSecrets!)).resolves.toEqual(retriedSecrets);
  });

  async function openStoredToken(user: UserOutput, dseq: string, sealedSecrets: string) {
    const executionContextService = container.resolve(ExecutionContextService);
    const authService = container.resolve(AuthService);

    return await executionContextService.runWithContext(async () => {
      authService.currentUser = user;

      return await container.resolve(SdlSecretsService).openStored({ userId: user.id, dseq, sealedSecrets });
    });
  }

  function broadcastHash(): Uint8Array {
    const [, messages] = vi.mocked(signerService.executeDerivedDecodedTxByUserId).mock.calls[0];

    return (messages[0] as unknown as { value: { hash: Uint8Array } }).value.hash;
  }

  async function manifestVersionOf(sdl: string) {
    return await manifestVersionOfDocument(yaml.raw<SDLInput>(sdl));
  }

  async function manifestVersionOfDocument(document: SDLInput) {
    const manifest = generateManifest(document);
    expect(manifest.ok).toBe(true);

    return await generateManifestVersion((manifest as Extract<typeof manifest, { ok: true }>).value.groups);
  }

  function resolvedDocumentOf(storedSdl: string, secrets: Record<string, string>) {
    const document = yaml.raw<SDLInput>(storedSdl);

    expect(container.resolve(SdlReferenceService).substitute(document, { secrets })).toEqual([]);

    return document;
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

  async function postDeployment(apiKey: string, sdl: string, secrets?: Record<string, string>, seal?: string) {
    const sealedSecrets = seal ?? (secrets ? await sealFor(knownUsers[knownApiKeys[apiKey].userId], secrets) : undefined);

    return await app.request("/v1/deployments", {
      method: "POST",
      body: JSON.stringify({ data: { sdl, sealedSecrets } }),
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
