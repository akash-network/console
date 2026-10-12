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
import { CORE_CONFIG, JOB_NAME } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ApplyDeploymentUpdateHandler } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.handler";
import { ApplyDeploymentUpdate } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.job";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentInfoGroupsFromSdl, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createManyLeaseApiResponses } from "@test/seeders/lease-api-response.seeder";
import { createLeaseStatus } from "@test/seeders/lease-status.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

registerFakeSdlSecretsKms();

const DSEQ = "1234";

const STORED_SDL = `version: "2.0"
services:
  web:
    image: nginx
    env:
      - API_TOKEN=ac-secret://s0_e0
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
          units: 0.1
        memory:
          size: 128Mi
        storage:
          - size: 128Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

type ActivityBody = { id: string; type: string; status: string; meta: Record<string, unknown> };

const applyWorkers = useJobWorkers(() => [container.resolve(ApplyDeploymentUpdateHandler)]);

describe("PATCH /v1/deployments/{dseq}?async=true", () => {
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

  it("answers 202 with the activity to follow and the version it saved, then applies it once the worker runs", async () => {
    const { apiKey, user, broadcast } = await setup();
    const { startWorkers } = await applyWorkers();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(202);
    const { data } = (await response.json()) as { data: { activityId: string; manifestVersion: string } };
    expect(data.manifestVersion).toBe((await settingOf(user.id))!.manifestVersion);
    expect(await activityOf(apiKey, data.activityId)).toMatchObject({
      type: "deployment_update",
      status: "pending",
      meta: { dseq: DSEQ, manifestVersion: data.manifestVersion }
    });
    expect(broadcast).not.toHaveBeenCalled();
    expect(providerService.sendManifest).not.toHaveBeenCalled();

    await startWorkers();

    await vi.waitFor(async () => expect(await activityOf(apiKey, data.activityId)).toMatchObject({ status: "succeeded" }), { timeout: 20_000, interval: 250 });
    const [[, [update]]] = broadcast.mock.calls;
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(Buffer.from(update.value.hash).toString("base64")).toBe(data.manifestVersion);
    expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ dseq: DSEQ, manifest: expect.stringContaining("nginx:1.27") }));
  });

  it("answers a conflicting patch on the request, queueing and recording nothing", async () => {
    const { apiKey, user } = await setup();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } }, ifManifestVersion: "U1RBTEU=" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "deployment_definition_changed" });
    expect(await activitiesOf(apiKey)).toEqual([]);
    expect(await findJobRows(ApplyDeploymentUpdate[JOB_NAME], { data: { userId: user.id } })).toEqual([]);
  });

  it("answers a refused patch on the request, queueing and recording nothing", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { services: { api: { image: "nginx:1.27" } } });

    expect(response.status).toBe(400);
    expect(await activitiesOf(apiKey)).toEqual([]);
  });

  it("renames during the request and answers as it always has for a name alone", async () => {
    const { apiKey } = await setup();

    const response = await patch(apiKey, { name: "renamed" });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Record<string, unknown> };
    expect(data).toMatchObject({ name: "renamed", deployment: expect.objectContaining({ id: expect.objectContaining({ dseq: DSEQ }) }) });
    expect(data).not.toHaveProperty("activityId");
    expect(await activitiesOf(apiKey)).toEqual([]);
  });

  it.each([
    { mode: "without async", query: "", backgroundUpdates: true },
    { mode: "with async while background updates are off", query: "?async=true", backgroundUpdates: false }
  ])("applies during the request $mode, answering as it always has and recording the update as succeeded", async ({ query, backgroundUpdates }) => {
    const { apiKey, broadcast } = await setup();
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockReturnValue(backgroundUpdates);

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, query);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { manifestVersion: string; deployment: { id: { dseq: string } } } };
    expect(data.deployment.id.dseq).toBe(DSEQ);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(await activitiesOf(apiKey)).toEqual([
      expect.objectContaining({ type: "deployment_update", status: "succeeded", meta: { dseq: DSEQ, manifestVersion: data.manifestVersion } })
    ]);
  });

  function patch(apiKey: string, data: Record<string, unknown>, query = "?async=true") {
    return app.request(`/v1/deployments/${DSEQ}${query}`, {
      method: "PATCH",
      body: JSON.stringify({ data }),
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
  }

  async function activityOf(apiKey: string, id: string) {
    const response = await app.request(`/v1/activities/${id}`, { headers: new Headers({ "x-api-key": apiKey }) });

    return ((await response.json()) as { data: ActivityBody }).data;
  }

  async function activitiesOf(apiKey: string) {
    const response = await app.request("/v1/activities", { headers: new Headers({ "x-api-key": apiKey }) });

    return ((await response.json()) as { data: { activities: ActivityBody[] } }).data.activities;
  }

  async function settingOf(userId: string) {
    return await deploymentSettingRepository.findOneBy({ userId, dseq: DSEQ });
  }

  async function recordedVersionFor(sdl: string, secrets: Record<string, string>) {
    const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });
    if (!resolved.ok) throw new Error(`The stored sdl does not resolve: ${resolved.value.map(error => error.message).join(", ")}`);

    return Buffer.from(resolved.value.manifestVersion).toString("base64");
  }

  async function mockChain(address: string) {
    const restUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
    const info = createDeploymentInfoSeed({
      owner: address,
      dseq: DSEQ,
      groups: createDeploymentInfoGroupsFromSdl({ sdl: STORED_SDL, owner: address, dseq: DSEQ })
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

  async function setup() {
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
    const broadcast = vi.spyOn(signerService, "executeDerivedDecodedTxByUserId").mockResolvedValue({
      code: 200,
      transactionHash: "fake-transaction-hash",
      hash: "fake-transaction-hash",
      rawLog: "fake-raw-log"
    });
    vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "getLeaseStatus").mockResolvedValue(createLeaseStatus());
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue(mock());

    await mockChain(address);

    const secrets = { s0_e0: randomUUID() };
    const sealedSecrets = await container.resolve(ExecutionContextService).runWithContext(async () => {
      container.resolve(AuthService).currentUser = user;

      return await container.resolve(SdlSecretsService).sealForStorage({ userId: user.id, dseq: DSEQ, secrets });
    });
    await deploymentSettingRepository.upsertDefinition({
      userId: user.id,
      dseq: DSEQ,
      sdl: STORED_SDL,
      manifestVersion: await recordedVersionFor(STORED_SDL, secrets),
      sealedSecrets
    });

    return { user, apiKey, broadcast };
  }
});
