import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import * as fs from "node:fs";
import * as path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { ManagedSignerService } from "@src/billing/services";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app } from "@src/rest-app";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

registerFakeSdlSecretsKms();

const SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

describe("Deployment projects", () => {
  beforeAll(async () => {
    await startJobQueues();
    await warmSealingKeyAsBootWould();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
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
      expect(signer.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("answers 404 to a member deploying into a project they were not granted", async () => {
      const { request, otherProject, caller, signer } = await setupCaller({ role: "member", grants: ["default"] });

      const response = await request("/v1/deployments", { method: "POST", body: { data: { sdl: SDL, projectId: otherProject.id } } });

      expect(response.status).toBe(404);
      expect(await deploymentRowsOf(caller.id)).toEqual([]);
      expect(signer.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
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
    });

    it.each<OrganizationRole>(["member", "viewer", "billing"])("refuses a %s and leaves the deployment where it is", async role => {
      const { request, team, defaultProject, otherProject, caller } = await setupCaller({ role, grants: ["default", "other"] });
      const deployment = await seedDeploymentSetting({ userId: caller.id, organizationId: team.id, projectId: defaultProject.id });

      const response = await request(`/v1/deployments/${deployment.dseq}/project`, { method: "PATCH", body: { data: { projectId: otherProject.id } } });

      expect(response.status).toBe(403);
      expect(await deploymentRow(caller.id, deployment.dseq)).toMatchObject({ projectId: defaultProject.id });
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
    vi.spyOn(signer, "assertCanBroadcast").mockResolvedValue(undefined);
    vi.spyOn(signer, "executeDerivedDecodedTxByUserId").mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });

    return signer;
  }

  async function seedWallet(userId: string, organizationId: string) {
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId, organizationId, address: createAkashAddress(), deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false });
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
    await seedWallet(caller.id, team.id);
    const authorization = signIn(caller.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [caller.id]);
    const signer = stubSigner();

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

    return { request, team, defaultProject, otherProject, owner, caller, signer };
  }
});
