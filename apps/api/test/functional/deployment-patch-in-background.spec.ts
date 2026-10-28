import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import { randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyAuthService } from "@src/auth/services/api-key/api-key-auth.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { ApplyDeploymentUpdateHandler } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.handler";
import { ApplyDeploymentUpdate, applyDeploymentUpdateKeyFor } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.job";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { ReconcileDeploymentUpdate } from "@src/deployment/services/reconcile-deployment-update/reconcile-deployment-update.job";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createApiKey } from "@test/seeders/api-key.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
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
  const activityRepository = container.resolve(ActivityRepository);

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
    const { apiKey, user, wallet, broadcast } = await setup();
    const { startWorkers } = await applyWorkers();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } });

    expect(response.status).toBe(202);
    const { data } = (await response.json()) as { data: { activityId: string; manifestVersion: string } };
    expect(data.manifestVersion).toBe((await settingOf(user.id))!.manifestVersion);
    expect(await activityOf(apiKey, data.activityId)).toMatchObject({
      type: "deployment_update",
      status: "pending",
      meta: { dseq: DSEQ, manifestVersion: data.manifestVersion, changes: { services: [{ service: "web", image: "nginx:1.27" }] } }
    });
    expect(broadcast).not.toHaveBeenCalled();
    expect(providerService.sendManifest).not.toHaveBeenCalled();

    await startWorkers();

    await vi.waitFor(async () => expect(await activityOf(apiKey, data.activityId)).toMatchObject({ status: "succeeded" }), { timeout: 20_000, interval: 250 });
    const [[signingWallet, [update]]] = broadcast.mock.calls;
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(signingWallet).toMatchObject({ id: wallet.id, userId: user.id });
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

  it("applies during the request without async, answering as it always has and recording the update as succeeded", async () => {
    const { apiKey, broadcast } = await setup();

    const response = await patch(apiKey, { services: { web: { image: "nginx:1.27" } } }, "");

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: { manifestVersion: string; deployment: { id: { dseq: string } } } };
    expect(data.deployment.id.dseq).toBe(DSEQ);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(await activitiesOf(apiKey)).toEqual([
      expect.objectContaining({
        type: "deployment_update",
        status: "succeeded",
        meta: { dseq: DSEQ, manifestVersion: data.manifestVersion, changes: { services: [{ service: "web", image: "nginx:1.27" }] } }
      })
    ]);
  });

  describe("on a team's deployment", () => {
    it("saves a member's update, then the worker applies it with the team's wallet for that member, reading the row another member filed", async () => {
      const { request, caller, owner, team, teamWallet, deployment, broadcast, pushManifest } = await setupTeamMember({ role: "member", grants: ["other"] });
      const { startWorkers } = await applyWorkers();

      const response = await request(`/v1/deployments/${deployment.dseq}?async=true`, { services: { web: { image: "nginx:1.27" } } });

      expect(response.status).toBe(202);
      const { data } = (await response.json()) as { data: { activityId: string; manifestVersion: string } };
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({
        manifestVersion: data.manifestVersion,
        sdl: expect.stringContaining("nginx:1.27")
      });
      const [apply] = await findJobRows(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: data.activityId } });
      expect(apply).toMatchObject({
        singleton_key: applyDeploymentUpdateKeyFor({ walletId: teamWallet.id, dseq: deployment.dseq }),
        data: { userId: caller.id, dseq: deployment.dseq, manifestVersion: data.manifestVersion, walletId: teamWallet.id, organizationId: team.id }
      });

      await startWorkers();

      await vi.waitFor(async () => expect(await activityRepository.findById(data.activityId)).toMatchObject({ userId: caller.id, status: "succeeded" }), {
        timeout: 20_000,
        interval: 250
      });
      const [[signingWallet, [update], options]] = broadcast.mock.calls;
      expect(signingWallet).toMatchObject({ id: teamWallet.id, userId: null, organizationId: team.id });
      expect(options).toEqual({ actingUserId: caller.id });
      expect(Buffer.from(update.value.hash).toString("base64")).toBe(data.manifestVersion);
      expect(pushManifest).toHaveBeenCalledWith(expect.objectContaining({ dseq: deployment.dseq, manifest: expect.stringContaining("nginx:1.27") }));
    });

    it.each<{ access: string; role: OrganizationRole; grant?: { project: "default" | "other"; role?: "viewer" } }>([
      { access: "a member limited to another project", role: "member", grant: { project: "default" } },
      { access: "a member who can only read the deployment's project", role: "member", grant: { project: "other", role: "viewer" } },
      { access: "a viewer of the team", role: "viewer" }
    ])("refuses $access as an update during the request does, saving, queueing and recording nothing", async ({ role, grant }) => {
      const { request, caller, owner, deployment, broadcast } = await setupTeamMember({ role, grants: grant ? [grant.project] : [], grantRole: grant?.role });
      const { startWorkers } = await applyWorkers();
      await startWorkers();

      const inBackground = await request(`/v1/deployments/${deployment.dseq}?async=true`, { services: { web: { image: "nginx:1.27" } } });
      const duringRequest = await request(`/v1/deployments/${deployment.dseq}`, { services: { web: { image: "nginx:1.27" } } });

      expect(inBackground.status).toBe(403);
      expect(duringRequest.status).toBe(403);
      expect(await inBackground.json()).toEqual(await duringRequest.json());
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ manifestVersion: deployment.manifestVersion, sdl: STORED_SDL });
      expect(await activityRepository.find({ userId: caller.id })).toEqual([]);
      expect(await findJobRows(ApplyDeploymentUpdate[JOB_NAME], { data: { dseq: deployment.dseq } })).toEqual([]);
      expect(await findJobRows(ReconcileDeploymentUpdate[JOB_NAME], { data: { dseq: deployment.dseq } })).toEqual([]);
      expect(broadcast).not.toHaveBeenCalled();
    });
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
        findOneByUserId: async () => wallets[0],
        findOneUsedBy: async () => wallets[0],
        findById: async id => wallets.find(wallet => wallet.id === id)
      })
    );
    const unscopedWallets = userWalletRepository.unscoped.bind(userWalletRepository);
    vi.spyOn(userWalletRepository, "unscoped").mockImplementation(reason =>
      reason === "member-access-validation"
        ? mock<UserWalletRepository>({ findById: async id => wallets.find(wallet => wallet.id === id) })
        : unscopedWallets(reason)
    );
    const broadcast = vi.spyOn(signerService, "executeDecodedTxByUserWallet").mockResolvedValue({
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

    return { user, wallet: wallets[0], apiKey, broadcast };
  }

  async function setupTeamMember(input: { role: OrganizationRole; grants: Array<"default" | "other">; grantRole?: "viewer" }) {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: signedUpUserInput() });
    const otherProject = await seedProject({ organizationId: team.id });
    const caller = await seedUser(signedUpUserInput());
    await seedOrganizationMember({ organizationId: team.id, userId: caller.id, role: input.role });
    for (const grant of input.grants) {
      const projectId = grant === "default" ? defaultProject.id : otherProject.id;
      await seedProjectMember({ organizationId: team.id, projectId, userId: caller.id, ...(input.grantRole ? { role: input.grantRole } : {}) });
    }
    const [teamWallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({
        userId: null,
        organizationId: team.id,
        createdByUserId: owner.id,
        address: createAkashAddress(),
        deploymentAllowance: "10000000",
        feeAllowance: "5000000",
        isTrialing: false,
        activatedAt: new Date()
      })
      .returning();

    const dseq = createDseq();
    const secrets = { s0_e0: randomUUID() };
    const sealedSecrets = await container.resolve(ExecutionContextService).runWithContext(async () => {
      container.resolve(AuthService).currentUser = createUser({ id: owner.id, userId: owner.userId ?? undefined });

      return await container.resolve(SdlSecretsService).sealForStorage({ userId: owner.id, dseq, secrets });
    });
    const deployment = await seedDeploymentSetting({
      userId: owner.id,
      organizationId: team.id,
      projectId: otherProject.id,
      dseq,
      sdl: STORED_SDL,
      manifestVersion: await recordedVersionFor(STORED_SDL, secrets),
      sealedSecrets,
      autoTopUpEnabled: false
    });

    const chain = teamChainDeployment(teamWallet.address as string, dseq);
    const deploymentReader = container.resolve(DeploymentReaderService);
    vi.spyOn(deploymentReader, "findWithGroupSpecsByWalletAndDseq").mockResolvedValue({ deployment: chain, groupSpecs: null });
    vi.spyOn(deploymentReader, "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(chain);
    const broadcast = vi
      .spyOn(signerService, "executeDecodedTxByUserWallet")
      .mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });
    const pushManifest = vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ type: "jwt", token: "provider-token" });
    enableOrganizationsFor(caller.id);
    const authorization = signIn(caller.userId!);

    const request = (path: string, data: Record<string, unknown>) =>
      app.request(path, {
        method: "PATCH",
        headers: { authorization, "content-type": "application/json", "x-organization-id": team.id },
        body: JSON.stringify({ data })
      });

    return { request, caller, owner, team, teamWallet, deployment, broadcast, pushManifest };
  }

  function teamChainDeployment(owner: string, dseq: string): DeploymentResponse {
    return {
      deployment: { id: { owner, dseq }, state: "active", hash: Buffer.from("an older version").toString("base64"), created_at: "1" },
      leases: [
        {
          id: { owner, dseq, gseq: 1, oseq: 1, provider: "akash1provider", bseq: 1 },
          state: "active",
          price: { denom: "uakt", amount: "1000" },
          created_at: "1",
          closed_on: "",
          status: null
        }
      ],
      escrow_account: {
        id: { scope: "deployment", xid: dseq },
        state: { owner, state: "open", transferred: [], settled_at: "0", funds: [], deposits: [] }
      }
    };
  }

  async function deploymentRow(userId: string, dseq: string) {
    const settings = resolveTable("DeploymentSettings");
    const [row] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select()
      .from(settings)
      .where(and(eq(settings.userId, userId), eq(settings.dseq, dseq)));

    return row;
  }

  function signedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function enableOrganizationsFor(userId: string) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return (context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id) === userId;
    });
  }
});
