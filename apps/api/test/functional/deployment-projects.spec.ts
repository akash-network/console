import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { EnableDeploymentAlertCommand } from "@src/billing/commands/enable-deployment-alert.command";
import { FundDeploymentCommand } from "@src/billing/commands/fund-deployment.command";
import { ManagedSignerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentResponse, PatchDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { CloseDeployment, closeDeploymentKeyFor } from "@src/deployment/services/close-deployment/close-deployment.job";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { MoveDeploymentAlertsJob } from "@src/deployment/services/move-deployment-alerts/move-deployment-alerts.job";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { app } from "@src/rest-app";
import { marketVersion } from "@src/utils/constants";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createBid } from "@test/seeders/bid.seeder";
import { findDeploymentDepositsOf } from "@test/seeders/db/deployment-deposit.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { findJobRows } from "@test/services/job-queue-harness";

registerFakeSdlSecretsKms();

const SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");
const CLIENT_MANIFEST = '{"client":"supplied"}';

describe("Deployment projects", () => {
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
  });

  describe("POST /v1/deployments", () => {
    it.each<OrganizationRole>(["owner", "admin", "member"])("files a %s's deployment into the project it names and records the creation there", async role => {
      const { request, team, otherProject, caller } = await setupCaller({ role, grants: ["other"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, name: "web", projectId: otherProject.id } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ organizationId: team.id, projectId: otherProject.id });
      expect(await activitiesOfProject(otherProject.id)).toEqual([
        expect.objectContaining({ type: "deployment_created", actorUserId: caller.id, payload: { dseq: data.dseq, name: "web" } })
      ]);
    });

    it("creates a team's deployment on chain with the team wallet, its deposit counted in the project it names for the member who asked", async () => {
      const { request, team, otherProject, caller, teamWallet, signedIndexes, reloadTargets } = await setupCaller({ role: "member", grants: ["other"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: otherProject.id } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(signedIndexes).toEqual([teamWallet.id]);
      expect(await findDeploymentDepositsOf(team.id)).toEqual([
        expect.objectContaining({
          kind: "deployment_create",
          owner: teamWallet.address,
          dseq: data.dseq,
          projectId: otherProject.id,
          actorUserId: caller.id,
          status: "confirmed"
        })
      ]);
      expect(reloadTargets).toEqual([{ walletId: teamWallet.id }]);
    });

    it("files a deployment naming no project into the default project", async () => {
      const { request, defaultProject, caller } = await setupCaller({ role: "member", grants: ["default"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ projectId: defaultProject.id });
    });

    it("files a member's deployment naming no project into the one project they were granted", async () => {
      const { request, otherProject, caller } = await setupCaller({ role: "member", grants: ["other"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ projectId: otherProject.id });
    });

    it("files a deployment naming no project into the project its API key is bound to", async () => {
      const { team, otherProject, owner } = await setupCaller({ role: "owner" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const response = await requestWithKey(apiKey, "/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(owner.id, data.dseq)).toMatchObject({ organizationId: team.id, projectId: otherProject.id });
    });

    it("answers 404 to a project-bound API key naming another project of its organization", async () => {
      const { team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const response = await requestWithKey(apiKey, "/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: defaultProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(owner.id)).toEqual([]);
    });

    it("files a deployment naming no project into the project a header narrows the request to", async () => {
      const { request, otherProject, caller } = await setupCaller({ role: "admin" });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } }, headers: { "x-project-id": otherProject.id } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ projectId: otherProject.id });
    });

    it("files a deployment naming no project into the default project for a member granted several", async () => {
      const { request, defaultProject, caller } = await setupCaller({ role: "member", grants: ["default", "other"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ projectId: defaultProject.id });
    });

    it("asks a member who reaches no project to choose one, recording and broadcasting nothing", async () => {
      const { request, caller, signer } = await setupCaller({ role: "member" });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "project_required" });
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
      expect(signer.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("asks a member granted several projects but not the default one to choose, recording and broadcasting nothing", async () => {
      const { request, team, caller, signer } = await setupCaller({ role: "member", grants: ["other"] });
      const third = await seedProject({ organizationId: team.id });
      await seedProjectMember({ organizationId: team.id, projectId: third.id, userId: caller.id });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "project_required" });
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
      expect(signer.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("answers 404 to a member deploying into a project where they hold the viewer project role, recording and broadcasting nothing", async () => {
      const { request, team, otherProject, caller, signer } = await setupCaller({ role: "member" });
      await seedProjectMember({ organizationId: team.id, projectId: otherProject.id, userId: caller.id, role: "viewer" });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: otherProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
      expect(signer.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("files a member's deployment naming no project into the one project they may write to", async () => {
      const { request, team, defaultProject, otherProject, caller } = await setupCaller({ role: "member" });
      await seedProjectMember({ organizationId: team.id, projectId: defaultProject.id, userId: caller.id, role: "viewer" });
      await seedProjectMember({ organizationId: team.id, projectId: otherProject.id, userId: caller.id, role: "admin" });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });
      const { data } = (await response.json()) as { data: { dseq: string } };

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ projectId: otherProject.id });
    });

    it("answers 404 to a member deploying into a project they were not granted", async () => {
      const { request, otherProject, caller, signer } = await setupCaller({ role: "member", grants: ["default"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: otherProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
      expect(signer.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("answers 404 for a deleted project", async () => {
      const { request, team, caller } = await setupCaller({ role: "admin" });
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: deleted.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
    });

    it("answers 404 for a project of another organization", async () => {
      const { request, caller } = await setupCaller({ role: "owner" });
      const { project: foreign } = await seedOrganizationWithOwner();

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: foreign.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
    });

    it.each<OrganizationRole>(["viewer", "billing"])("refuses a %s", async role => {
      const { request, caller } = await setupCaller({ role, grants: ["default"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL } } });

      expect(response.status).toBe(403);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
    });

    it("ignores the project it names while organizations are off, filing into the personal default project and its feed", async () => {
      const { request, otherProject, caller } = await setupCaller({ role: "owner", organizationsOn: false });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, name: "web", projectId: otherProject.id } } });
      const { data } = (await response.json()) as { data: { dseq: string } };
      const personalDefault = await personalDefaultProjectOf(caller.id);

      expect(response.status).toBe(201);
      expect(await deploymentRow(caller.id, data.dseq)).toMatchObject({ organizationId: personalDefault.organizationId, projectId: personalDefault.id });
      expect(await activitiesOfProject(personalDefault.id)).toEqual([
        expect.objectContaining({ type: "deployment_created", actorUserId: caller.id, payload: { dseq: data.dseq, name: "web" } })
      ]);
    });

    it("answers 400 for a project id that is not a uuid", async () => {
      const { request } = await setupCaller({ role: "owner" });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: "web" } } });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /v1/deployments/{dseq}", () => {
    it("records the close in the deployment's project, credited to the caller", async () => {
      const { request, team, otherProject, caller, signer } = await setupCaller({ role: "member", grants: ["other"] });
      const deployment = await seedDeploymentSetting({ userId: caller.id, organizationId: team.id, projectId: otherProject.id, name: "api" });
      vi.spyOn(container.resolve(DeploymentReaderService), "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(
        mock<DeploymentResponse>({ deployment: { state: "active", id: { dseq: deployment.dseq } } })
      );
      vi.spyOn(signer, "ensureFeeGrants").mockResolvedValue(5_000_000);
      vi.spyOn(signer, "executeDerivedTx").mockResolvedValue(mock<Awaited<ReturnType<ManagedSignerService["executeDerivedTx"]>>>({ code: 0, hash: "tx-hash" }));
      vi.spyOn(container.resolve(BalancesService), "refreshUserWalletLimits").mockResolvedValue(undefined);

      const response = await request(`/v1/deployments/${deployment.dseq}`, { method: "DELETE" });

      expect(response.status).toBe(200);
      expect(await deploymentRow(caller.id, deployment.dseq)).toMatchObject({ closed: true });
      expect(await activitiesOfProject(otherProject.id)).toEqual([
        expect.objectContaining({ type: "deployment_closed", actorUserId: caller.id, payload: { dseq: deployment.dseq, name: "api", reason: null } })
      ]);
    });

    it("queues a member's own background close of a team deployment when Console's close of it sits in the filer's feed", async () => {
      const { request, team, otherProject, owner, caller } = await setupCaller({ role: "member", grants: ["other"] });
      const teamWallet = await teamWalletOf(team.id);
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });
      mockActiveDeployment(deployment.dseq);
      const filersEntry = await activityRepository.create(
        systemClosedActivityOf({ userId: owner.id, owner: teamWallet.address!, dseq: deployment.dseq, reason: "runtime_limit_reached" })
      );

      const response = await request(`/v1/deployments/${deployment.dseq}?async=true`, { method: "DELETE" });
      const { data } = (await response.json()) as { data: { activityId: string } };

      expect(response.status).toBe(202);
      expect(await activityRepository.findById(data.activityId)).toMatchObject({
        userId: caller.id,
        status: "pending",
        initiator: "user",
        dedupeKey: `deployment_close.${teamWallet.address}.${deployment.dseq}`
      });
      expect(await activityRepository.find({ userId: owner.id })).toEqual([filersEntry]);
      expect(await findJobRows(CloseDeployment[JOB_NAME], { singletonKey: closeDeploymentKeyFor({ userId: caller.id, dseq: deployment.dseq }) })).toEqual([
        expect.objectContaining({ data: expect.objectContaining({ userId: caller.id, activityId: data.activityId, walletId: teamWallet.id }) })
      ]);
    });

    it("answers a background close of a team deployment Console already closed for the caller without queuing a close or adding an entry", async () => {
      const { request, team, otherProject, caller } = await setupCaller({ role: "member", grants: ["other"] });
      const teamWallet = await teamWalletOf(team.id);
      const deployment = await seedDeploymentSetting({ userId: caller.id, organizationId: team.id, projectId: otherProject.id });
      mockActiveDeployment(deployment.dseq);
      const consolesClose = await activityRepository.create(
        systemClosedActivityOf({ userId: caller.id, owner: teamWallet.address!, dseq: deployment.dseq, reason: "provider_unreachable" })
      );

      const response = await request(`/v1/deployments/${deployment.dseq}?async=true`, { method: "DELETE" });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { success: true } });
      expect(await activityRepository.find({ userId: caller.id })).toEqual([consolesClose]);
      expect(await findJobRows(CloseDeployment[JOB_NAME], { singletonKey: closeDeploymentKeyFor({ userId: caller.id, dseq: deployment.dseq }) })).toEqual([]);
    });
  });

  describe("POST /v1/leases", () => {
    it("completes a lease an earlier attempt landed on the team wallet, queueing its funding and alert once for the member who asked", async () => {
      const { request, caller, signer, teamWallet, dseq, provider } = await setupLandedTeamLease();
      const broadcast = vi.spyOn(signer, "executeDecodedTxByUserWallet");

      const first = await postLease(request, { dseq, provider });
      const second = await postLease(request, { dseq, provider });

      expect([first.status, second.status]).toEqual([200, 200]);
      expect(broadcast).not.toHaveBeenCalled();
      expect(vi.mocked(container.resolve(ProviderService).sendManifest)).toHaveBeenCalledTimes(2);
      expect(await followUpJobsOf(dseq, teamWallet.id)).toEqual({
        funding: [expect.objectContaining({ data: expect.objectContaining({ walletId: teamWallet.id, address: teamWallet.address, dseq }) })],
        alert: [expect.objectContaining({ data: expect.objectContaining({ userId: caller.id, walletAddress: teamWallet.address, dseq }) })]
      });
    });

    it("completes a team wallet's lease a lagging node hid instead of refusing its bid as no longer open", async () => {
      const { request, caller, signer, teamWallet, dseq, provider } = await setupLandedTeamLease({ hiddenOnce: true });
      const broadcast = vi.spyOn(signer, "executeDecodedTxByUserWallet");

      const response = await postLease(request, { dseq, provider });

      expect(response.status).toBe(200);
      expect(broadcast).not.toHaveBeenCalled();
      expect(await followUpJobsOf(dseq, teamWallet.id)).toEqual({
        funding: [expect.objectContaining({ data: expect.objectContaining({ walletId: teamWallet.id, address: teamWallet.address, dseq }) })],
        alert: [expect.objectContaining({ data: expect.objectContaining({ userId: caller.id, walletAddress: teamWallet.address, dseq }) })]
      });
    });

    async function setupLandedTeamLease(input: { hiddenOnce?: boolean } = {}) {
      const caller = await setupCaller({ role: "member", grants: ["other"] });
      const { dseq } = await seedDeploymentSetting({ userId: caller.caller.id, organizationId: caller.team.id, projectId: caller.otherProject.id });
      const provider = createAkashAddress();
      const owner = caller.teamWallet.address;
      const restApiUrl = container.resolve(CORE_CONFIG).REST_API_NODE_URL;
      const leasesPath = `/akash/market/${marketVersion}/leases/list?filters.owner=${owner}&filters.dseq=${dseq}`;
      const leasedBid = createBid({ owner, dseq, gseq: 1, oseq: 1, provider });
      leasedBid.bid.state = "active";

      if (input.hiddenOnce) {
        nock(restApiUrl)
          .get(leasesPath)
          .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });
      }
      nock(restApiUrl)
        .persist()
        .get(leasesPath)
        .reply(200, {
          leases: [createLeaseApiResponse({ owner, dseq, gseq: 1, oseq: 1, provider, state: "active" })],
          pagination: { next_key: null, total: "1" }
        })
        .get(`/akash/market/${marketVersion}/bids/list`)
        .query(query => query["filters.owner"] === owner && query["filters.dseq"] === dseq)
        .reply(200, { bids: [leasedBid], pagination: { next_key: null, total: "1" } });
      vi.spyOn(container.resolve(DeploymentReaderService), "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(
        mock<DeploymentResponse>({ deployment: { state: "active", id: { dseq } } })
      );
      vi.spyOn(container.resolve(ProviderService), "toProviderAuth").mockResolvedValue({ type: "jwt", token: "jwt-token" });
      vi.spyOn(container.resolve(ProviderService), "sendManifest").mockResolvedValue(true);
      vi.spyOn(container.resolve(BalancesService), "refreshUserWalletLimits").mockResolvedValue(undefined);

      return { ...caller, dseq, provider };
    }

    function postLease(request: Awaited<ReturnType<typeof setupCaller>>["request"], { dseq, provider }: { dseq: string; provider: string }) {
      return request("/v1/leases", { method: "POST", body: { manifest: CLIENT_MANIFEST, leases: [{ dseq, gseq: 1, oseq: 1, provider }] } });
    }

    async function followUpJobsOf(dseq: string, walletId: number) {
      const [funding, alert] = await Promise.all([
        findJobRows(FundDeploymentCommand[JOB_NAME], { singletonKey: `FundDeploymentCommand.${dseq}.${walletId}` }),
        findJobRows(EnableDeploymentAlertCommand[JOB_NAME], { singletonKey: `EnableDeploymentAlertCommand.${dseq}.${walletId}` })
      ]);

      return { funding, alert };
    }
  });

  describe("PATCH /v1/deployments/{dseq}", () => {
    it("saves a member's update to a deployment another member filed and applies it with the organization's wallet", async () => {
      const { request, team, otherProject, owner, caller, signer, teamWallet } = await setupCaller({ role: "member", grants: ["other"] });
      const deployment = await seedDeploymentSetting({
        userId: owner.id,
        organizationId: team.id,
        projectId: otherProject.id,
        sdl: SDL,
        manifestVersion: "BAUG"
      });
      const chain = mock<DeploymentResponse>({
        deployment: { state: "active", id: { dseq: deployment.dseq }, hash: "BAUG" },
        leases: [{ id: { provider: "akash1provider" } }]
      });
      const deploymentReader = container.resolve(DeploymentReaderService);
      vi.spyOn(deploymentReader, "findWithGroupSpecsByWalletAndDseq").mockResolvedValue({ deployment: chain, groupSpecs: null });
      vi.spyOn(deploymentReader, "findByWalletAndDseq").mockResolvedValue(chain);
      const broadcast = vi
        .spyOn(signer, "executeDecodedTxByUserWallet")
        .mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });
      const providerService = container.resolve(ProviderService);
      vi.spyOn(providerService, "toProviderAuth").mockResolvedValue({ type: "jwt", token: "provider-token" });
      const pushManifest = vi.spyOn(providerService, "sendManifest").mockResolvedValue(true);

      const response = await request(`/v1/deployments/${deployment.dseq}`, {
        method: "PATCH",
        body: { data: { services: { web: { image: "nginx:1.27.1-alpine" } } } }
      });
      const { data } = (await response.json()) as PatchDeploymentResponse;

      expect(response.status).toBe(200);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({
        sdl: expect.stringContaining("image: nginx:1.27.1-alpine"),
        manifestVersion: data.manifestVersion
      });
      expect(broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ id: teamWallet.id, userId: null, organizationId: team.id }),
        [expect.objectContaining({ typeUrl: expect.stringContaining("MsgUpdateDeployment") })],
        { actingUserId: caller.id }
      );
      expect(pushManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: "akash1provider", dseq: deployment.dseq }));
    });
  });

  describe("PATCH /v1/deployments/{dseq}/project", () => {
    it.each<OrganizationRole>(["owner", "admin"])("lets an %s move a deployment to another project and records the move there", async role => {
      const { request, team, defaultProject, otherProject, owner, caller } = await setupCaller({ role });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id, name: "api" });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: otherProject.id } } });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { dseq: deployment.dseq, projectId: otherProject.id } });
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: otherProject.id });
      expect(await activitiesOfProject(otherProject.id)).toEqual([
        expect.objectContaining({
          type: "deployment_moved",
          actorUserId: caller.id,
          payload: { dseq: deployment.dseq, name: "api", toProjectName: otherProject.name }
        })
      ]);
      expect(await alertMovesOf(team.id, deployment.dseq)).toEqual([
        expect.objectContaining({ data: { organizationId: team.id, dseq: deployment.dseq, version: 1 } })
      ]);
    });

    it.each<OrganizationRole>(["member", "viewer", "billing"])("refuses a %s and leaves the deployment where it is", async role => {
      const { request, team, defaultProject, otherProject, caller } = await setupCaller({ role, grants: ["default", "other"] });
      const deployment = await seedDeploymentSetting({ userId: caller.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: otherProject.id } } });

      expect(response.status).toBe(403);
      expect(await deploymentRow(caller.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
      expect(await alertMovesOf(team.id, deployment.dseq)).toEqual([]);
    });

    it("answers 404 to a project-bound API key moving a deployment out of a project beyond its reach", async () => {
      const { team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await requestWithKey(apiKey, `/v1/deployments/${deployment.dseq}/project`, {
        method: "PATCH",
        body: { data: { projectId: otherProject.id } }
      });

      expect(response.status).toBe(404);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
    });

    it("answers 404 to a project-bound API key moving a deployment into a project beyond its reach", async () => {
      const { team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const response = await requestWithKey(apiKey, `/v1/deployments/${deployment.dseq}/project`, {
        method: "PATCH",
        body: { data: { projectId: defaultProject.id } }
      });

      expect(response.status).toBe(404);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: otherProject.id });
    });

    it("answers 404 for a deleted target project", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "owner" });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });
      const deleted = await seedProject({ organizationId: team.id, deletedAt: new Date() });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: deleted.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
    });

    it("answers 404 for a target project of another organization", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "owner" });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });
      const { project: foreign } = await seedOrganizationWithOwner();

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: foreign.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
    });

    it("answers 404 for a deployment of another organization", async () => {
      const { request, otherProject } = await setupCaller({ role: "owner" });
      const { user: stranger, organization: foreign, project: foreignProject } = await seedOrganizationWithOwner();
      const deployment = await seedDeploymentSetting({ userId: stranger.id, organizationId: foreign.id, projectId: foreignProject.id });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: otherProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRow(stranger.id, deployment.dseq)).toMatchObject({ projectId: foreignProject.id });
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request, team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner", organizationsOn: false });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: otherProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRow(owner.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
    });
  });

  describe("GET /v1/deployment-locations/{dseq}", () => {
    it("locates a deployment in an organization of the caller, whichever organization the request runs in", async () => {
      const { request, team, otherProject, owner } = await setupCaller({ role: "admin" });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const response = await request(`/v1/deployment-locations/${deployment.dseq}`, { organizationHeader: false });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { organizationId: team.id, organizationSlug: team.slug, projectId: otherProject.id } });
    });

    it("answers 404 to a member for a deployment of a project they were not granted", async () => {
      const { request, team, otherProject, owner } = await setupCaller({ role: "member", grants: ["default"] });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const response = await request(`/v1/deployment-locations/${deployment.dseq}`);

      expect(response.status).toBe(404);
    });

    it("answers 404 for a deployment of an organization the caller does not belong to", async () => {
      const { request } = await setupCaller({ role: "owner" });
      const { user: stranger, organization: foreign, project: foreignProject } = await seedOrganizationWithOwner();
      const deployment = await seedDeploymentSetting({ userId: stranger.id, organizationId: foreign.id, projectId: foreignProject.id });

      const response = await request(`/v1/deployment-locations/${deployment.dseq}`);

      expect(response.status).toBe(404);
    });

    it("answers 404 to a project-bound API key for a deployment of another project of its organization", async () => {
      const { team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });
      const outside = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });
      const inside = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const outsideResponse = await requestWithKey(apiKey, `/v1/deployment-locations/${outside.dseq}`);
      const insideResponse = await requestWithKey(apiKey, `/v1/deployment-locations/${inside.dseq}`);

      expect(outsideResponse.status).toBe(404);
      expect(insideResponse.status).toBe(200);
    });

    it("answers 404 to an API key for a deployment of another organization of its owner", async () => {
      const { team, owner } = await setupCaller({ role: "owner" });
      const { organization: other, project: otherDefault } = await seedOrganizationWithOwner();
      await seedOrganizationMember({ organizationId: other.id, userId: owner.id, role: "admin" });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: other.id, projectId: otherDefault.id });

      const response = await requestWithKey(apiKey, `/v1/deployment-locations/${deployment.dseq}`);

      expect(response.status).toBe(404);
    });

    it("answers 404 to a request a header narrows to another project", async () => {
      const { request, team, defaultProject, otherProject, owner } = await setupCaller({ role: "owner" });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await request(`/v1/deployment-locations/${deployment.dseq}`, { headers: { "x-project-id": otherProject.id } });

      expect(response.status).toBe(404);
    });

    it("answers like an unknown path while organizations are off for the caller", async () => {
      const { request, team, defaultProject, owner } = await setupCaller({ role: "owner", organizationsOn: false });
      const deployment = await seedDeploymentSetting({ userId: owner.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await request(`/v1/deployment-locations/${deployment.dseq}`);

      expect(response.status).toBe(404);
    });
  });

  function requestWithKey(apiKey: string, requestPath: string, init: { method?: string; body?: unknown } = {}) {
    return app.request(requestPath, {
      method: init.method ?? "GET",
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body)
    });
  }

  async function teamWalletOf(organizationId: string) {
    const wallets = resolveTable("UserWallets");
    const [wallet] = await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(wallets).where(eq(wallets.organizationId, organizationId));

    return wallet;
  }

  function mockActiveDeployment(dseq: string) {
    vi.spyOn(container.resolve(DeploymentReaderService), "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(
      mock<DeploymentResponse>({ deployment: { state: "active", id: { dseq } } })
    );
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

  async function deploymentRowsOf(userId: string) {
    const settings = resolveTable("DeploymentSettings");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(settings).where(eq(settings.userId, userId));
  }

  async function personalDefaultProjectOf(userId: string) {
    const [members, organizations, projects] = [resolveTable("OrganizationMembers"), resolveTable("Organizations"), resolveTable("Projects")];
    const [{ project }] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select({ project: projects })
      .from(members)
      .innerJoin(organizations, and(eq(organizations.id, members.organizationId), eq(organizations.type, "personal")))
      .innerJoin(projects, and(eq(projects.organizationId, organizations.id), eq(projects.isDefault, true)))
      .where(eq(members.userId, userId));

    return project;
  }

  async function activitiesOfProject(projectId: string) {
    const activities = resolveTable("OrganizationActivities");

    return await container.resolve<ApiPgDatabase>(POSTGRES_DB).select().from(activities).where(eq(activities.projectId, projectId));
  }

  async function alertMovesOf(organizationId: string, dseq: string) {
    return await findJobRows(MoveDeploymentAlertsJob[JOB_NAME], { data: { organizationId, dseq } });
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function enableOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  function stubSigner() {
    const signer = container.resolve(ManagedSignerService);
    const txManagerService = container.resolve(TxManagerService);
    const balancesService = container.resolve(BalancesService);
    const signedIndexes: number[] = [];
    const reloadTargets: unknown[] = [];
    vi.spyOn(signer, "assertCanBroadcast").mockResolvedValue(undefined);
    vi.spyOn(signer, "ensureFeeGrants").mockResolvedValue(5_000_000);
    vi.spyOn(signer, "executeDecodedTxByUserWallet");
    vi.spyOn(txManagerService, "getFundingWalletAddress").mockResolvedValue(createAkashAddress());
    vi.spyOn(txManagerService, "signAndBroadcastWithDerivedWallet").mockImplementation(async derivationIndex => {
      signedIndexes.push(derivationIndex);
      return { code: 0, hash: "TX-HASH", rawLog: "[]" };
    });
    vi.spyOn(balancesService, "retrieveDeploymentLimit").mockResolvedValue(10_000_000);
    vi.spyOn(balancesService, "refreshUserWalletLimits").mockResolvedValue(undefined);
    vi.spyOn(container.resolve(WalletReloadJobService), "scheduleImmediate").mockImplementation(async target => {
      reloadTargets.push(target);
      return false;
    });
    vi.spyOn(container.resolve(DenomExchangeService), "getExchangeRateToUSD").mockResolvedValue({
      price: 2,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    });

    return { signer, signedIndexes, reloadTargets };
  }

  async function seedWallets(input: { userId: string; organizationId: string }) {
    const funding = { deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false, activatedAt: new Date() };
    const [teamWallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values([
        { userId: null, organizationId: input.organizationId, createdByUserId: input.userId, address: createAkashAddress(), ...funding },
        { userId: input.userId, address: createAkashAddress(), ...funding }
      ])
      .returning();

    return { ...teamWallet, address: teamWallet.address as string };
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId?: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return apiKey;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  async function setupCaller(input: { role: OrganizationRole; organizationsOn?: boolean; grants?: Array<"default" | "other"> }) {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const otherProject = await seedProject({ organizationId: team.id });
    const caller = input.role === "owner" ? owner : await seedUser(createSignedUpUserInput());
    if (input.role !== "owner") {
      await seedOrganizationMember({ organizationId: team.id, userId: caller.id, role: input.role });
    }
    for (const grant of input.grants ?? []) {
      await seedProjectMember({ organizationId: team.id, projectId: grant === "default" ? defaultProject.id : otherProject.id, userId: caller.id });
    }
    const teamWallet = await seedWallets({ userId: caller.id, organizationId: team.id });
    const authorization = signIn(caller.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [caller.id]);
    const { signer, signedIndexes, reloadTargets } = stubSigner();

    const request = (requestPath: string, init: { method?: string; body?: unknown; organizationHeader?: boolean; headers?: Record<string, string> } = {}) =>
      app.request(requestPath, {
        method: init.method ?? "GET",
        headers: {
          authorization,
          "content-type": "application/json",
          ...(init.organizationHeader === false ? {} : { "x-organization-id": team.id }),
          ...init.headers
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });

    return { request, team, defaultProject, otherProject, owner, caller, signer, teamWallet, signedIndexes, reloadTargets };
  }
});
