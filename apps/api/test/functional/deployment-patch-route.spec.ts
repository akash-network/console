import { faker } from "@faker-js/faker";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { CORE_CONFIG } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { app } from "@src/rest-app";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createProvider } from "@test/seeders/provider.seeder";

registerFakeSdlSecretsKms();

const DSEQ = "1234";
const REPLACED_MANIFEST_VERSION = "AAAA";
const STORED_SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

describe("PATCH /v1/deployments/{dseq} route wiring", () => {
  const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);

  beforeAll(async () => {
    await startJobQueues();
    await warmSealingKeyAsBootWould();
  }, 20_000);

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
    nock.cleanAll();
  });

  it("rejects an unauthenticated request", async () => {
    const response = await patch(undefined, { services: { web: { image: "nginx" } } });

    expect(response.status).toBe(401);
  });

  it("reaches the controller and answers 404 for a deployment the console recorded nothing for", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: { web: { image: "nginx" } } });

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("nothing to patch");
  });

  it("refuses a body naming no services before it reaches the controller", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: {} });

    expect(response.status).toBe(400);
  });

  it("refuses a service patch naming no field before it reaches the controller", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: { web: {} } });

    expect(response.status).toBe(400);
  });

  it("refuses an empty seal offered as the only thing the patch would write", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: { web: {} }, sealedSecrets: "" });

    expect(response.status).toBe(400);
  });

  it("refuses an env key that is not an environment variable name", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: { web: { env: { "A=B": "c" } } } });

    expect(response.status).toBe(400);
  });

  it("answers 200 with the patched deployment under data", async () => {
    const { apiKey } = await setup({ recordsDefinition: true });

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
    const { apiKey, user } = await setup({ recordsDefinition: true });

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    const { data } = (await response.json()) as { data: { manifestVersion: string } };
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq: DSEQ });
    expect(data.manifestVersion).toBe(setting?.manifestVersion);
    expect(data.manifestVersion).not.toBe(REPLACED_MANIFEST_VERSION);
  });

  it("pushes the patched manifest to the provider holding the lease", async () => {
    const { apiKey, sentManifests } = await setup({ recordsDefinition: true });

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(200);
    expect(sentManifests()).toEqual([expect.stringContaining("nginx:1.27")]);
  });

  it("broadcasts an update of the deployment the patch rewrote", async () => {
    const { apiKey, broadcastMessages } = await setup({ recordsDefinition: true });

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(200);
    expect(broadcastMessages()).toEqual([{ typeUrl: `/akash.deployment.${deploymentVersion}.MsgUpdateDeployment`, value: expect.any(String) }]);
  });

  function patch(apiKey: string | undefined, data: Record<string, unknown>) {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (apiKey) headers.set("x-api-key", apiKey);

    return app.request(`/v1/deployments/${DSEQ}`, { method: "PATCH", body: JSON.stringify({ data }), headers });
  }

  async function persistApiKeyFor(userId: string) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();

    await container.resolve(ApiKeyRepository).create({
      userId,
      name: faker.company.name(),
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
    });

    return apiKey;
  }

  function nockChain({ address, provider }: { address: string; provider: string }) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const leases = [createLeaseApiResponse({ owner: address, dseq: DSEQ, provider, state: "active" })];

    nock(restUrl)
      .persist()
      .get(`/akash/deployment/${deploymentVersion}/deployments/info`)
      .query({ "id.owner": address, "id.dseq": DSEQ })
      .reply(200, createDeploymentInfoSeed({ owner: address, dseq: DSEQ }))
      .get(`/akash/market/${marketVersion}/leases/list`)
      .query(query => query["filters.owner"] === address && query["filters.dseq"] === DSEQ)
      .reply(200, { leases })
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances?\/.*/)
      .reply(200, createFeeAllowanceResponse({ grantee: address, amount: "5000000" }))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ grantee: address, amount: "20000000", grantType: "/akash.escrow.v1.DepositAuthorization" }));
  }

  function nockTxSigner() {
    const broadcastMessages: { typeUrl: string }[] = [];

    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post("/v1/tx/derived")
      .reply(200, (_uri, body) => {
        broadcastMessages.push(...(body as { data: { messages: { typeUrl: string }[] } }).data.messages);
        return { data: { code: 0, hash: "SOME_HASH", rawLog: "[]" } };
      });

    return () => broadcastMessages;
  }

  function nockProviderProxy() {
    const sentManifests: string[] = [];

    nock(container.resolve(DeploymentConfigService).get("PROVIDER_PROXY_URL"))
      .persist()
      .post("/", body => (body as { url: string }).url.endsWith("/manifest"))
      .reply(200, (_uri, body) => {
        sentManifests.push((body as { body: string }).body);
        return { ok: true };
      })
      .post("/", body => (body as { url: string }).url.includes("/status"))
      .reply(200, createLeaseStatus());

    return () => sentManifests;
  }

  async function setup(input: { recordsDefinition?: boolean } = {}) {
    const { user, address } = await seedUserWithWallet({ isTrialing: false, activatedAt: new Date() });
    const apiKey = await persistApiKeyFor(user.id);
    const provider = createAkashAddress();

    await createProvider({ owner: provider, deletedHeight: null });
    nockChain({ address, provider });
    const broadcastMessages = nockTxSigner();
    const sentManifests = nockProviderProxy();

    if (input.recordsDefinition) {
      await deploymentSettingRepository.upsertDefinition({
        userId: user.id,
        dseq: DSEQ,
        sdl: STORED_SDL,
        manifestVersion: REPLACED_MANIFEST_VERSION
      });
    }

    return { user, apiKey, sentManifests, broadcastMessages };
  }
});
