import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { type ApiPgDatabase, CORE_CONFIG, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { GetSpendRateResponse, GetWeeklyDeploymentCostResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app, initDb } from "@src/rest-app";

import { createAkashAddress, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";

const BLOCK_RATES_BY_PROJECT = [100, 200, 400];
const WEEKLY_COSTS_BY_PROJECT = [10.08, 20.16, 40.32];

describe("Spend figures by project access", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/weekly-cost", () => {
    it.each<OrganizationRole>(["owner", "admin", "billing"])("answers the whole team's weekly cost to the %s", async role => {
      const { request } = await setupTeam({ role });

      const response = await request("/v1/weekly-cost");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { weeklyCost: sumOf(WEEKLY_COSTS_BY_PROJECT) } });
    });

    it.each<OrganizationRole>(["member", "viewer"])("answers a %s the weekly cost of the two projects they were granted", async role => {
      const { request } = await setupTeam({ role, grantedProjectIndexes: [0, 1] });

      const response = await request("/v1/weekly-cost");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { weeklyCost: sumOf(WEEKLY_COSTS_BY_PROJECT.slice(0, 2)) } });
    });

    it("answers an owner's key bound to one project the weekly cost of that project", async () => {
      const { requestWithKeyBoundTo } = await setupTeam({ role: "owner" });

      const response = await requestWithKeyBoundTo(2, "/v1/weekly-cost");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: { weeklyCost: WEEKLY_COSTS_BY_PROJECT[2] } });
    });

    it("answers a personal organization the weekly cost it answered while organizations were off", async () => {
      const personal = await setupPersonal();
      const before = (await (await personal.request("/v1/weekly-cost", { organizationsOn: false })).json()) as GetWeeklyDeploymentCostResponse;

      const response = await personal.request("/v1/weekly-cost", { organizationsOn: true });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(before);
      expect(before).toEqual({ data: { weeklyCost: sumOf(WEEKLY_COSTS_BY_PROJECT.slice(0, 2)) } });
    });
  });

  describe("GET /v1/spend-rate", () => {
    it.each<OrganizationRole>(["owner", "admin", "billing"])("answers the spend rate of every team deployment to the %s", async role => {
      const { request, dseqs } = await setupTeam({ role });

      const response = await request("/v1/spend-rate");

      expect(response.status).toBe(200);
      expect(await spentDseqsOf(response)).toEqual([...dseqs].sort());
    });

    it.each<OrganizationRole>(["member", "viewer"])("answers a %s the spend rate of the deployments in the two projects they were granted", async role => {
      const { request, dseqs } = await setupTeam({ role, grantedProjectIndexes: [0, 1] });

      const response = await request("/v1/spend-rate");

      expect(response.status).toBe(200);
      expect(await spentDseqsOf(response)).toEqual(dseqs.slice(0, 2).sort());
    });

    it("answers an owner's key bound to one project the spend rate of that project's deployment", async () => {
      const { requestWithKeyBoundTo, dseqs } = await setupTeam({ role: "owner" });

      const response = await requestWithKeyBoundTo(2, "/v1/spend-rate");

      expect(response.status).toBe(200);
      expect(await spentDseqsOf(response)).toEqual([dseqs[2]]);
    });

    it("answers a personal organization the spend rate it answered while organizations were off", async () => {
      const personal = await setupPersonal();
      const before = (await (await personal.request("/v1/spend-rate", { organizationsOn: false })).json()) as GetSpendRateResponse;

      const response = await personal.request("/v1/spend-rate", { organizationsOn: true });

      expect(response.status).toBe(200);
      expect(sortedByDseq(((await response.json()) as GetSpendRateResponse).data.deployments)).toEqual(sortedByDseq(before.data.deployments));
      expect(before.data.deployments.map(({ dseq }) => dseq).sort()).toEqual([...personal.dseqs].sort());
    });
  });

  async function spentDseqsOf(response: Response) {
    const { data } = (await response.json()) as GetSpendRateResponse;

    return data.deployments.map(({ dseq }) => dseq).sort();
  }

  function sortedByDseq(deployments: GetSpendRateResponse["data"]["deployments"]) {
    return [...deployments].sort((a, b) => a.dseq.localeCompare(b.dseq));
  }

  function sumOf(amounts: number[]) {
    return Number(amounts.reduce((total, amount) => total + amount, 0).toFixed(2));
  }

  function createDseq() {
    return faker.string.numeric({ length: 10, allowLeadingZeros: false });
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}` };
  }

  function signIn(externalUserId: string) {
    const token = faker.string.alphanumeric(40);
    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(async header =>
      header.replace(/^Bearer +/i, "") === token ? externalUserId : null
    );

    return `Bearer ${token}`;
  }

  function setOrganizationsFor(userIds: string[]) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return userIds.includes(context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id ?? "");
    });
  }

  async function seedApiKey(input: { userId: string; organizationId: string; projectId: string }) {
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

  async function seedWallet(input: { userId: string | null; organizationId: string; createdByUserId: string }) {
    const [wallet] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ ...input, address: createAkashAddress(), isTrialing: false, activatedAt: new Date() })
      .returning();

    return wallet.address as string;
  }

  async function seedRunningDeployments(input: { owner: string; filerUserId: string; organizationId: string; projectIds: string[] }) {
    const dseqs = input.projectIds.map(() => createDseq());

    for (const [index, projectId] of input.projectIds.entries()) {
      await seedDeploymentSetting({ userId: input.filerUserId, organizationId: input.organizationId, projectId, dseq: dseqs[index] });
      await seedLiveLease(input.owner, dseqs[index], BLOCK_RATES_BY_PROJECT[index]);
    }

    answerChain(input.owner, new Map(dseqs.map((dseq, index) => [dseq, BLOCK_RATES_BY_PROJECT[index]])));

    return dseqs;
  }

  async function seedLiveLease(owner: string, dseq: string, price: number) {
    const deployment = await createDeployment({ owner, dseq });
    const provider = await createProvider();
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner, dseq, gseq: 1 });
    await createLease({
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      owner,
      dseq,
      gseq: 1,
      oseq: 1,
      providerAddress: provider.owner,
      price,
      denom: "uakt"
    });
  }

  function answerChain(owner: string, blockRateByDseq: Map<string, number>) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get("/akash/market/v1beta5/leases/list")
      .query(query => query["filters.owner"] === owner)
      .reply(200, uri => {
        const dseq = new URL(uri, "http://chain").searchParams.get("filters.dseq") ?? "";
        const blockRate = blockRateByDseq.get(dseq);
        const leases = blockRate
          ? [createLeaseApiResponse({ owner, dseq, gseq: 1, oseq: 1, state: "active", price: { denom: "uakt", amount: String(blockRate) } })]
          : [];

        return { leases, pagination: { next_key: null, total: String(leases.length) } };
      })
      .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      .reply(200, { block: { header: { height: "1000" } } })
      .get("/akash/oracle/v2/aggregated_price/akt")
      .query(true)
      .reply(200, { aggregated_price: { median_price: "1" }, price_health: { is_healthy: true } })
      .get("/akash/oracle/v2/prices")
      .query(true)
      .reply(200, { prices: [{ state: { price: "1" } }] });
  }

  async function setupTeam(input: { role: OrganizationRole; grantedProjectIndexes?: number[] }) {
    await initDb();
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const projects = [defaultProject, ...(await Promise.all([seedProject({ organizationId: team.id }), seedProject({ organizationId: team.id })]))];
    const caller = input.role === "owner" ? owner : await seedUser(createSignedUpUserInput());
    if (input.role !== "owner") {
      await seedOrganizationMember({ organizationId: team.id, userId: caller.id, role: input.role });
    }
    for (const index of input.grantedProjectIndexes ?? []) {
      await seedProjectMember({
        organizationId: team.id,
        projectId: projects[index].id,
        userId: caller.id,
        role: input.role === "viewer" ? "viewer" : "member"
      });
    }
    const owningAddress = await seedWallet({ userId: null, organizationId: team.id, createdByUserId: owner.id });
    const dseqs = await seedRunningDeployments({
      owner: owningAddress,
      filerUserId: owner.id,
      organizationId: team.id,
      projectIds: projects.map(({ id }) => id)
    });
    const authorization = signIn(caller.userId!);
    setOrganizationsFor([caller.id]);

    const request = (path: string) => app.request(path, { headers: { authorization, "x-organization-id": team.id } });
    const requestWithKeyBoundTo = async (projectIndex: number, path: string) => {
      const apiKey = await seedApiKey({ userId: caller.id, organizationId: team.id, projectId: projects[projectIndex].id });

      return await app.request(path, { headers: { "x-api-key": apiKey } });
    };

    return { request, requestWithKeyBoundTo, dseqs };
  }

  async function setupPersonal() {
    await initDb();
    const { user, organization: personal, project } = await seedOrganizationWithOwner({ type: "personal", user: createSignedUpUserInput() });
    const owningAddress = await seedWallet({ userId: user.id, organizationId: personal.id, createdByUserId: user.id });
    const dseqs = await seedRunningDeployments({
      owner: owningAddress,
      filerUserId: user.id,
      organizationId: personal.id,
      projectIds: [project.id, project.id]
    });
    const authorization = signIn(user.userId!);

    const request = (path: string, options: { organizationsOn: boolean }) => {
      setOrganizationsFor(options.organizationsOn ? [user.id] : []);

      return app.request(path, { headers: { authorization } });
    };

    return { request, dseqs };
  }
});
