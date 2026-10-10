import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app, initDb } from "@src/rest-app";
import { deploymentVersion, marketVersion } from "@src/utils/constants";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeployment } from "@test/seeders/deployment.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

type ListedDeployment = { deployment: { id: { owner: string; dseq: string }; state: string }; name: string | null; projectId?: string | null };
type ListResponse = { data: { deployments: ListedDeployment[]; pagination: { total: number | null; skip: number; limit: number; hasMore: boolean } } };
type SendRequest = (requestPath: string) => Response | Promise<Response>;

const EMPTY_PAGE = { deployments: [], pagination: { total: 0, skip: 0, limit: 100, hasMore: false } };

describe("Deployment list by project", () => {
  beforeAll(async () => {
    await initDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/deployments", () => {
    it("lists every project's deployments to an owner, whoever deployed them, each with its project", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "owner" });
      const own = await deploy({ projectId: defaultProject.id });
      const colleagues = await deploy({ projectId: otherProject.id, by: "colleague" });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(body.data.deployments.map(item => [item.deployment.id.owner, item.deployment.id.dseq, item.projectId])).toEqual([
        [own.owner, own.dseq, defaultProject.id],
        [colleagues.owner, colleagues.dseq, otherProject.id]
      ]);
      expect(body.data.pagination).toEqual({ total: 2, skip: 0, limit: 100, hasMore: false });
    });

    it("lists to a member only the deployments of the project they were granted", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "member", grants: ["other"] });
      await deploy({ projectId: defaultProject.id, by: "colleague" });
      const granted = await deploy({ projectId: otherProject.id, by: "colleague" });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(dseqsOf(body)).toEqual([granted.dseq]);
      expect(body.data.pagination.total).toBe(1);
    });

    it("lists to a viewer the deployments of the project they were granted", async () => {
      const { request, otherProject, deploy } = await setupCaller({ role: "viewer", grants: ["other"] });
      const granted = await deploy({ projectId: otherProject.id, by: "colleague" });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(dseqsOf(body)).toEqual([granted.dseq]);
    });

    it("lists nothing to a billing member", async () => {
      const { request, defaultProject, deploy } = await setupCaller({ role: "billing" });
      await deploy({ projectId: defaultProject.id, by: "colleague" });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(body.data).toEqual(EMPTY_PAGE);
    });

    it("lists nothing of another organization, even under the same dseq", async () => {
      const { request, defaultProject, deploy } = await setupCaller({ role: "owner" });
      const own = await deploy({ projectId: defaultProject.id });
      const { user: stranger, organization: foreign, project: foreignProject } = await seedOrganizationWithOwner();
      const strangerAddress = await seedWallet(stranger.id);
      await seedDeploymentSetting({ userId: stranger.id, organizationId: foreign.id, projectId: foreignProject.id, dseq: own.dseq });
      await createDeployment({ owner: strangerAddress, dseq: own.dseq });

      const { body } = await list(request, "/v1/deployments");

      expect(body.data.deployments.map(item => item.deployment.id.owner)).toEqual([own.owner]);
    });

    it("keeps to the project a request names", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "admin" });
      await deploy({ projectId: defaultProject.id });
      const inOther = await deploy({ projectId: otherProject.id });

      const { body } = await list(request, `/v1/deployments?projectId=${otherProject.id}`);

      expect(dseqsOf(body)).toEqual([inOther.dseq]);
    });

    it("lists a project a member was not granted exactly like a project that does not exist", async () => {
      const { request, defaultProject, deploy } = await setupCaller({ role: "member", grants: ["other"] });
      await deploy({ projectId: defaultProject.id, by: "colleague" });

      const notGranted = await list(request, `/v1/deployments?projectId=${defaultProject.id}`);
      const missing = await list(request, `/v1/deployments?projectId=${faker.string.uuid()}`);

      expect(notGranted).toEqual({ status: 200, body: { data: EMPTY_PAGE } });
      expect(missing).toEqual(notGranted);
    });

    it("answers 400 for a project that is not named by its uuid", async () => {
      const { request } = await setupCaller({ role: "owner" });

      const response = await request("/v1/deployments?projectId=default");

      expect(response.status).toBe(400);
    });

    it("lists a deployment closed on chain as closed even when the console has not flagged it yet", async () => {
      const { request, defaultProject, deploy } = await setupCaller({ role: "owner" });
      const running = await deploy({ projectId: defaultProject.id });
      const flagged = await deploy({ projectId: defaultProject.id, flaggedClosed: true, closedOnChain: true });
      const unflagged = await deploy({ projectId: defaultProject.id, closedOnChain: true });

      const active = await list(request, "/v1/deployments?state=active");
      const archived = await list(request, "/v1/deployments?state=closed");

      expect(active.body.data.deployments.map(item => [item.deployment.id.dseq, item.deployment.state])).toEqual([[running.dseq, "active"]]);
      expect(archived.body.data.deployments.map(item => [item.deployment.id.dseq, item.deployment.state])).toEqual([
        [flagged.dseq, "closed"],
        [unflagged.dseq, "closed"]
      ]);
      expect(archived.body.data.pagination.total).toBe(2);
    });

    it("lists a deployment filed moments ago as active before the chain index has seen it, and leaves out an older one it never saw", async () => {
      const { request, defaultProject, deploy, backdate } = await setupCaller({ role: "owner" });
      const fresh = await deploy({ projectId: defaultProject.id, indexed: false });
      const stale = await deploy({ projectId: defaultProject.id, indexed: false });
      await backdate(stale.id, "11 minutes");
      const onChain = createDeploymentInfoSeed({ owner: fresh.owner, dseq: fresh.dseq, state: "active" });
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${fresh.owner}&id.dseq=${fresh.dseq}`)
        .reply(200, onChain)
        .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${fresh.owner}&filters.dseq=${fresh.dseq}`)
        .reply(200, { leases: [], pagination: { next_key: null, total: "0" } });

      const { body } = await list(request, "/v1/deployments", { chainUnavailable: false });

      expect(dseqsOf(body)).toEqual([fresh.dseq]);
      expect(body.data.pagination.total).toBe(1);
    });

    it("lists nothing of a deleted project, whether named or not", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "owner" });
      const kept = await deploy({ projectId: defaultProject.id });
      await deploy({ projectId: otherProject.id, flaggedClosed: true, closedOnChain: true });
      await deploy({ projectId: otherProject.id });
      await softDelete(otherProject.id);

      const everyProject = await list(request, "/v1/deployments");
      const archive = await list(request, "/v1/deployments?state=closed");
      const deleted = await list(request, `/v1/deployments?projectId=${otherProject.id}`);

      expect(dseqsOf(everyProject.body)).toEqual([kept.dseq]);
      expect(archive.body.data).toEqual(EMPTY_PAGE);
      expect(deleted.body.data).toEqual(EMPTY_PAGE);
    });

    it("lists nothing to a member granted no project", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "member" });
      await deploy({ projectId: defaultProject.id, by: "colleague" });
      await deploy({ projectId: otherProject.id, by: "colleague" });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(body.data).toEqual(EMPTY_PAGE);
    });

    it("keeps to the project a header narrows the request to", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "admin" });
      await deploy({ projectId: defaultProject.id });
      const inOther = await deploy({ projectId: otherProject.id });

      const narrowed = await list(requestPath => request(requestPath, { "x-project-id": otherProject.id }), "/v1/deployments");
      const narrowedElsewhere = await list(requestPath => request(requestPath, { "x-project-id": otherProject.id }), `/v1/deployments?projectId=${defaultProject.id}`);

      expect(dseqsOf(narrowed.body)).toEqual([inOther.dseq]);
      expect(narrowedElsewhere.body.data).toEqual(EMPTY_PAGE);
    });

    it("searches the names of the deployments the caller reaches, whatever case it is typed in", async () => {
      const { request, otherProject, deploy } = await setupCaller({ role: "member", grants: ["other"] });
      const web = await deploy({ projectId: otherProject.id, name: "my-web-app" });
      await deploy({ projectId: otherProject.id, name: "database" });

      const { body } = await list(request, "/v1/deployments?search=WEB");

      expect(body.data.deployments.map(item => [item.deployment.id.dseq, item.name])).toEqual([[web.dseq, "my-web-app"]]);
      expect(body.data.pagination.total).toBe(1);
    });

    it("pages the deployments the caller reaches, newest first when reversed", async () => {
      const { request, defaultProject, deploy } = await setupCaller({ role: "owner" });
      const dseqs: string[] = [];
      for (let index = 0; index < 5; index++) {
        dseqs.push((await deploy({ projectId: defaultProject.id })).dseq);
      }
      const newestFirst = [...dseqs].reverse();

      const first = await list(request, "/v1/deployments?reverse=true&limit=2");
      const second = await list(request, "/v1/deployments?reverse=true&limit=2&skip=2");
      const last = await list(request, "/v1/deployments?reverse=true&limit=2&skip=4");

      expect(dseqsOf(first.body)).toEqual(newestFirst.slice(0, 2));
      expect(dseqsOf(second.body)).toEqual(newestFirst.slice(2, 4));
      expect(dseqsOf(last.body)).toEqual(newestFirst.slice(4));
      expect(first.body.data.pagination).toEqual({ total: 5, skip: 0, limit: 2, hasMore: true });
      expect(second.body.data.pagination).toEqual({ total: 5, skip: 2, limit: 2, hasMore: true });
      expect(last.body.data.pagination).toEqual({ total: 5, skip: 4, limit: 2, hasMore: false });
    });

    it("lists to a project-bound API key only the deployments of its project", async () => {
      const { team, defaultProject, otherProject, owner, deploy } = await setupCaller({ role: "owner" });
      await deploy({ projectId: defaultProject.id });
      const inOther = await deploy({ projectId: otherProject.id });
      const apiKey = await seedApiKey({ userId: owner.id, organizationId: team.id, projectId: otherProject.id });

      const withKey: SendRequest = requestPath => app.request(requestPath, { headers: { "x-api-key": apiKey } });

      const { status, body } = await list(withKey, "/v1/deployments");
      const elsewhere = await list(withKey, `/v1/deployments?projectId=${defaultProject.id}`);

      expect(status).toBe(200);
      expect(dseqsOf(body)).toEqual([inOther.dseq]);
      expect(elsewhere.body.data).toEqual(EMPTY_PAGE);
    });

    it("reads each listed deployment from the chain by the address that owns it", async () => {
      const { request, otherProject, deploy } = await setupCaller({ role: "member", grants: ["other"] });
      const deployment = await deploy({ projectId: otherProject.id, by: "colleague" });
      const onChain = createDeploymentInfoSeed({ owner: deployment.owner, dseq: deployment.dseq, state: "active" });
      const lease = createLeaseApiResponse({ owner: deployment.owner, dseq: deployment.dseq, state: "active" });
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
        .get(`/akash/deployment/${deploymentVersion}/deployments/info?id.owner=${deployment.owner}&id.dseq=${deployment.dseq}`)
        .reply(200, onChain)
        .get(`/akash/market/${marketVersion}/leases/list?filters.owner=${deployment.owner}&filters.dseq=${deployment.dseq}`)
        .reply(200, { leases: [lease], pagination: { next_key: null, total: "1" } });

      const { body } = await list(request, "/v1/deployments", { chainUnavailable: false });

      expect(body.data.deployments).toEqual([
        expect.objectContaining({ deployment: onChain.deployment, escrow_account: onChain.escrow_account, leases: [lease.lease], projectId: otherProject.id })
      ]);
    });

    it("lists a personal organization's whole wallet, deployments the console never recorded included, each with its project", async () => {
      const { request, user, address, organization, project } = await setupPersonalCaller();
      const recorded = await createDeployment({ owner: address, dseq: "1001" });
      const unrecorded = await createDeployment({ owner: address, dseq: "1002" });
      await seedDeploymentSetting({ userId: user.id, organizationId: organization.id, projectId: project.id, dseq: recorded.dseq });

      const { status, body } = await list(request, "/v1/deployments");

      expect(status).toBe(200);
      expect(new Map(body.data.deployments.map(item => [item.deployment.id.dseq, item.projectId]))).toEqual(
        new Map([
          [recorded.dseq, project.id],
          [unrecorded.dseq, null]
        ])
      );
    });

    it("lists the wallet as before while organizations are off for the caller, ignoring a project and adding none", async () => {
      const { request, defaultProject, otherProject, deploy } = await setupCaller({ role: "owner", organizationsOn: false });
      const own = await deploy({ projectId: defaultProject.id });

      const { status, body } = await list(request, `/v1/deployments?projectId=${otherProject.id}`);

      expect(status).toBe(200);
      expect(dseqsOf(body)).toEqual([own.dseq]);
      expect(body.data.deployments[0]).not.toHaveProperty("projectId");
    });
  });

  async function list(request: SendRequest, requestPath: string, { chainUnavailable = true }: { chainUnavailable?: boolean } = {}) {
    if (chainUnavailable) {
      nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL).persist().get(/.*/).reply(503, { code: 14, message: "unavailable" });
    }

    const response = await request(requestPath);

    return { status: response.status, body: (await response.json()) as ListResponse };
  }

  function dseqsOf(body: ListResponse) {
    return body.data.deployments.map(item => item.deployment.id.dseq);
  }

  async function seedWallet(userId: string, organizationId?: string) {
    const address = createAkashAddress();
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId, organizationId, address, deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false });

    return address;
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
    const colleague = await seedUser(createSignedUpUserInput());
    await seedOrganizationMember({ organizationId: team.id, userId: colleague.id, role: "admin" });
    const addresses = { caller: await seedWallet(caller.id), colleague: await seedWallet(colleague.id) };
    const deployers = { caller: caller.id, colleague: colleague.id };
    const authorization = signIn(caller.userId!);
    enableOrganizationsFor(input.organizationsOn === false ? [] : [caller.id]);
    let nextDseq = faker.number.int({ min: 1_000_000, max: 9_000_000 });

    async function deploy({
      projectId,
      by = "caller",
      name,
      flaggedClosed = false,
      closedOnChain = false,
      indexed = true
    }: {
      projectId: string;
      by?: "caller" | "colleague";
      name?: string;
      flaggedClosed?: boolean;
      closedOnChain?: boolean;
      indexed?: boolean;
    }) {
      const dseq = String(nextDseq++);
      const row = await seedDeploymentSetting({ userId: deployers[by], organizationId: team.id, projectId, dseq, name, closed: flaggedClosed });
      if (indexed) {
        await createDeployment({ owner: addresses[by], dseq, closedHeight: closedOnChain ? 5_000_000 : undefined });
      }

      return { id: row.id, dseq, owner: addresses[by] };
    }

    async function backdate(id: string, age: string) {
      const table = resolveTable("DeploymentSettings");
      await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .update(table)
        .set({ createdAt: sql`now() - ${age}::interval` })
        .where(eq(table.id, id));
    }

    const request = (requestPath: string, headers: Record<string, string> = {}) =>
      app.request(requestPath, {
        method: "GET",
        headers: { authorization, "content-type": "application/json", "x-organization-id": team.id, ...headers }
      });

    return { request, team, defaultProject, otherProject, owner, deploy, backdate };
  }

  async function softDelete(projectId: string) {
    const table = resolveTable("Projects");
    await container.resolve<ApiPgDatabase>(POSTGRES_DB).update(table).set({ deletedAt: new Date() }).where(eq(table.id, projectId));
  }

  async function setupPersonalCaller() {
    const { user, organization, project } = await seedOrganizationWithOwner({ type: "personal", user: createSignedUpUserInput() });
    const address = await seedWallet(user.id, organization.id);
    const authorization = signIn(user.userId!);
    enableOrganizationsFor([user.id]);
    const request: SendRequest = requestPath => app.request(requestPath, { method: "GET", headers: { authorization, "content-type": "application/json" } });

    return { request, user, address, organization, project };
  }
});
