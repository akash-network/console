import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, generateManifestVersion, yaml } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import nock from "nock";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";
import { UserRepository } from "@src/user/repositories";
import { dataFolderPath } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const GALLERY_TEMPLATES_PATH = `${dataFolderPath}/templates/v1/templates`;
const TEMPLATE_ID = `functional-${randomUUID()}`;
const TEMPLATE_SDL = `version: "2.0"
services:
  web:
    image: nginx:1.25.3
    env:
      - LOG_LEVEL=info
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const SERVICE = {
  image: "ghcr.io/acme/api:1.4.0",
  resources: { cpu: 1, memory: "1Gi", storage: "2Gi" },
  ports: [{ port: 3000, as: 80 }],
  env: { LOG_LEVEL: "info" }
};

const SERVICE_SDL: SDLInput = {
  version: "2.0",
  services: { app: { image: "ghcr.io/acme/api:1.4.0", env: ["LOG_LEVEL=info"], expose: [{ port: 3000, as: 80, to: [{ global: true }] }] } },
  profiles: {
    compute: { app: { resources: { cpu: { units: 1 }, memory: { size: "1Gi" }, storage: { size: "2Gi" } } } },
    placement: { dcloud: { pricing: { app: { denom: "uact", amount: 100_000 } } } }
  },
  deployment: { app: { dcloud: { profile: "app", count: 1 } } }
};

const { client: kmsClient } = registerFakeSdlSecretsKms();

describe("Deployment create without an SDL", () => {
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
    await mkdir(GALLERY_TEMPLATES_PATH, { recursive: true });
    await writeFile(`${GALLERY_TEMPLATES_PATH}/${TEMPLATE_ID}.json`, JSON.stringify({ data: { id: TEMPLATE_ID, name: "nginx", deploy: TEMPLATE_SDL } }));
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
      findOneByUserId: async (id: string) => knownWallets[id][0],
      findOneUsedBy: async (id: string) => knownWallets[id][0],
      findById: async (id: number) =>
        Object.values(knownWallets)
          .flat()
          .find(wallet => wallet.id === id)
    } as unknown as UserWalletRepository);
    vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(signerService, "assertCanBroadcast").mockResolvedValue(undefined);
    kmsClient.asymmetricDecrypt.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await rm(`${GALLERY_TEMPLATES_PATH}/${TEMPLATE_ID}.json`, { force: true });
    await container.dispose();
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("from a service", () => {
    it("stores the SDL of one service named app, written from the inputs", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, { service: SERVICE, secretEnv: [] });

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      expect(yaml.raw<SDLInput>(setting!.sdl!)).toEqual(SERVICE_SDL);
      expect(setting!.sealedSecrets).toBeNull();
    });

    it("commits the manifest version of the SDL it wrote", async () => {
      const { apiKey } = await persistedUser();

      const response = await postDeployment(apiKey, { service: SERVICE, secretEnv: [] });

      expect(response.status).toBe(201);
      expect(broadcastHash()).toEqual(await manifestVersionOf(SERVICE_SDL));
    });

    it("seals the env value secretEnv names and stores the other as submitted", async () => {
      const { apiKey, user } = await persistedUser();
      const token = randomUUID();

      const response = await postDeployment(apiKey, { service: { ...SERVICE, env: { API_TOKEN: token, LOG_LEVEL: "info" } }, secretEnv: ["API_TOKEN"] });

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      expect(yaml.raw<SDLInput>(setting!.sdl!).services.app.env).toEqual(["API_TOKEN=ac-secret://s0_e0", "LOG_LEVEL=info"]);
      expect(JSON.stringify(setting)).not.toContain(token);
    });

    it("seals every env value of a request that does not say which are secret", async () => {
      const { apiKey, user } = await persistedUser();
      const token = randomUUID();

      const response = await postDeployment(apiKey, { service: { ...SERVICE, env: { API_TOKEN: token } } });

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      expect(yaml.raw<SDLInput>(setting!.sdl!).services.app.env).toEqual(["API_TOKEN=ac-secret://s0_e0"]);
      expect(JSON.stringify(setting)).not.toContain(token);
    });

    it("refuses a service that opens no port, recording nothing and broadcasting nothing", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, { service: { ...SERVICE, ports: [] } });

      expect(response.status).toBe(400);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });
  });

  describe("from a gallery template", () => {
    it("stores the template's SDL as the gallery holds it and links the deployment to the template", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, { templateId: TEMPLATE_ID, secretEnv: [] });

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      expect(yaml.raw<SDLInput>(setting!.sdl!)).toEqual(yaml.raw<SDLInput>(TEMPLATE_SDL));
      expect(setting!.templateId).toBe(TEMPLATE_ID);
    });

    it("stores the template's SDL with the overrides applied", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, {
        templateId: TEMPLATE_ID,
        overrides: { web: { image: "nginx:1.27.2", env: { LOG_LEVEL: "debug", WORKERS: "4" } } },
        secretEnv: []
      });

      expect(response.status).toBe(201);
      const setting = await settingOf(user, response);
      const stored = yaml.raw<SDLInput>(setting!.sdl!);
      expect(stored.services.web.image).toBe("nginx:1.27.2");
      expect(stored.services.web.env).toEqual(["LOG_LEVEL=debug", "WORKERS=4"]);
      expect(stored.profiles).toEqual(yaml.raw<SDLInput>(TEMPLATE_SDL).profiles);
    });

    it("commits the manifest version of the template's SDL with the overrides applied", async () => {
      const { apiKey } = await persistedUser();
      const overridden = yaml.raw<SDLInput>(TEMPLATE_SDL.replace("LOG_LEVEL=info", "LOG_LEVEL=debug"));

      const response = await postDeployment(apiKey, { templateId: TEMPLATE_ID, overrides: { web: { env: { LOG_LEVEL: "debug" } } }, secretEnv: [] });

      expect(response.status).toBe(201);
      expect(broadcastHash()).toEqual(await manifestVersionOf(overridden));
    });

    it("answers not found for a template the gallery does not list, recording nothing and broadcasting nothing", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, { templateId: `functional-${randomUUID()}` });

      expect(response.status).toBe(404);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("refuses overrides naming a service the template does not declare", async () => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, { templateId: TEMPLATE_ID, overrides: { api: { image: "nginx:1.27.2" } } });

      expect(response.status).toBe(400);
      expect(await response.text()).toContain('\\"api\\" is not a service of this deployment');
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });
  });

  describe("when the request does not name exactly one thing to deploy", () => {
    it.each<[string, Record<string, unknown>, string]>([
      ["neither an SDL, a service nor a template", {}, "Send one of sdl, service or templateId"],
      ["an SDL and a service", { sdl: TEMPLATE_SDL, service: SERVICE }, "Send either sdl or service, not both"],
      ["a service and a template", { service: SERVICE, templateId: TEMPLATE_ID }, "service cannot be combined with templateId or templateVersionId"],
      [
        "overrides for a submitted SDL",
        { sdl: TEMPLATE_SDL, templateId: TEMPLATE_ID, overrides: { web: { image: "nginx:1.27.2" } } },
        "overrides apply only to a deployment created from templateId without sdl"
      ]
    ])("refuses %s, recording nothing and broadcasting nothing", async (_, data, message) => {
      const { apiKey, user } = await persistedUser();

      const response = await postDeployment(apiKey, data);

      expect(response.status).toBe(400);
      expect(await response.text()).toContain(message);
      expect(await deploymentSettingRepository.findOneBy({ userId: user.id })).toBeUndefined();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });
  });

  function broadcastHash(): Uint8Array {
    const [, messages] = vi.mocked(signerService.executeDecodedTxByUserWallet).mock.calls[0];

    return (messages[0] as unknown as { value: { hash: Uint8Array } }).value.hash;
  }

  async function manifestVersionOf(document: SDLInput) {
    const manifest = generateManifest(document);
    expect(manifest.ok).toBe(true);

    return await generateManifestVersion((manifest as Extract<typeof manifest, { ok: true }>).value.groups);
  }

  async function settingOf(user: UserOutput, response: Response) {
    const { data } = (await response.clone().json()) as { data: { dseq: string } };

    return await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: data.dseq });
  }

  async function postDeployment(apiKey: string, data: Record<string, unknown>) {
    return await app.request("/v1/deployments", {
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
