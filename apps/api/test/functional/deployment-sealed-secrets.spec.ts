import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { CompactEncrypt, decodeProtectedHeader } from "jose";
import nock from "nock";
import { constants, generateKeyPairSync, privateDecrypt, randomUUID } from "node:crypto";
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
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient, SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { app } from "@src/rest-app";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";

import { createApiKey } from "@test/seeders/api-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

interface OpenApiPaths {
  paths: Record<
    string,
    Record<string, { requestBody: { content: Record<string, { schema: { properties: { data: { properties: Record<string, unknown> } } } }> } }>
  >;
}

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
const MAX_VALUE_BYTES = 16 * 1024;
const MAX_COUNT = 100;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const kmsClient = mock<SdlSecretsKmsClient>();
kmsClient.getPublicKey.mockResolvedValue([
  { name: VERSION_NAME, pem: publicKeyPem, pemCrc32c: { value: String(crc32c.calculate(publicKeyPem)) }, algorithm: "RSA_DECRYPT_OAEP_3072_SHA256" }
]);
kmsClient.asymmetricDecrypt.mockImplementation(async request => {
  const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(request.ciphertext));

  return [
    {
      plaintext,
      plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) },
      verifiedCiphertextCrc32c: true
    } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
  ];
});

container.register<SdlSecretsKmsTarget>(SDL_SECRETS_KMS_TARGET, { useValue: { client: kmsClient, versionName: VERSION_NAME, kid: KID } });

function sdlWith(services: Record<string, string[]>) {
  const bodies = Object.entries(services)
    .map(([name, env]) => `  ${name}:\n    image: nginx\n    env:\n${env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("")}`)
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

  it("returns no secret value, in the manifest it hands back or anywhere else in the body", async () => {
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

  it("creates a deployment with no secrets at all without reaching the key service", async () => {
    const { apiKey, user } = await persistedUser();

    const response = await postDeployment(apiKey, sdlWith({ web: ["LOG_LEVEL=debug"] }));

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

  async function openStoredToken(user: UserOutput, dseq: string, token: string) {
    const executionContextService = container.resolve(ExecutionContextService);
    const authService = container.resolve(AuthService);

    return await executionContextService.runWithContext(async () => {
      authService.currentUser = user;

      return JSON.parse(await container.resolve(SecretCipherService).decrypt(user.id, token, { sub: user.id, dseq })) as Record<string, string>;
    });
  }

  function broadcastHash(): Uint8Array {
    const [, messages] = vi.mocked(signerService.executeDerivedDecodedTxByUserId).mock.calls[0];

    return (messages[0] as unknown as { value: { hash: Uint8Array } }).value.hash;
  }

  async function manifestVersionOf(sdl: string) {
    const manifest = generateManifest(yaml.raw<SDLInput>(sdl));
    expect(manifest.ok).toBe(true);

    return await generateManifestVersion((manifest as Extract<typeof manifest, { ok: true }>).value.groups);
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
        kid: KID,
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

  async function warmSealingKeyAsBootWould() {
    await container.resolve(SdlSecretsSealingKeyService).getSealingKey();
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
