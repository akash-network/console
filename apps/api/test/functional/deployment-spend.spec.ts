import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { ListDeploymentSpendResponse } from "@src/organization/http-schemas/deployment-spend.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app, initDb } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { createAkashAddress, createAkashBlock, createDay, createDeployment, createDeploymentGroup, createLease, createProvider } from "@test/seeders";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const RANGE = "startDate=2026-09-01&endDate=2026-09-03";

const DAYS = [
  { date: "2026-09-01", firstBlockHeight: 1000, lastBlockHeightYet: 1960, lastBlockAt: "2026-09-02T00:00:00.000Z" },
  { date: "2026-09-02", firstBlockHeight: 2000, lastBlockHeightYet: 2960, lastBlockAt: "2026-09-03T00:00:00.000Z" },
  { date: "2026-09-03", firstBlockHeight: 3000, lastBlockHeightYet: 3480, lastBlockAt: "2026-09-03T12:00:00.000Z" }
];

const PRICE_PER_BLOCK = 10_000;

describe("Deployment spend", () => {
  let chainDays: Promise<string> | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/deployment-spend", () => {
    it("gives an owner each deployment's spend and hours and each project's spend per day, deployments filed in no project included", async () => {
      const { owner, staging, defaultProject, deployments, actAs } = await setup();

      const response = await actAs(owner)(`/v1/deployment-spend?${RANGE}`);
      const { data } = (await response.json()) as ListDeploymentSpendResponse;

      expect(response.status).toBe(200);
      expect(data.projects).toEqual([
        { projectId: defaultProject.id, name: defaultProject.name, isDefault: true, isDeleted: false },
        { projectId: staging.id, name: staging.name, isDefault: false, isDeleted: false }
      ]);
      expect(data.days).toHaveLength(5);
      expect(data.days).toEqual(
        expect.arrayContaining([
          { date: "2026-09-01", projectId: staging.id, consumedUsd: 9.6 },
          { date: "2026-09-02", projectId: defaultProject.id, consumedUsd: 14.4 },
          { date: "2026-09-02", projectId: staging.id, consumedUsd: 4.8 },
          { date: "2026-09-03", projectId: defaultProject.id, consumedUsd: 9.6 },
          { date: "2026-09-03", projectId: null, consumedUsd: 2.4 }
        ])
      );
      expect(data.deployments).toEqual([
        { dseq: deployments.api, name: "api", projectId: defaultProject.id, consumedUsd: 24, hours: 36 },
        { dseq: deployments.web, name: null, projectId: staging.id, consumedUsd: 14.4, hours: 36 },
        { dseq: deployments.unrecorded, name: null, projectId: null, consumedUsd: 2.4, hours: 6 }
      ]);
    });

    it("gives the billing role every deployment", async () => {
      const { deployments, actAs, addMember } = await setup();
      const billing = await addMember("billing");

      const response = await actAs(billing)(`/v1/deployment-spend?${RANGE}`);
      const { data } = (await response.json()) as ListDeploymentSpendResponse;

      expect(data.deployments.map(({ dseq }) => dseq)).toEqual([deployments.api, deployments.web, deployments.unrecorded]);
    });

    it("gives a member granted one project only that project's deployments", async () => {
      const { team, staging, deployments, actAs, addMember } = await setup();
      const member = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: staging.id, userId: member.id, role: "member" });

      const response = await actAs(member)(`/v1/deployment-spend?${RANGE}`);
      const { data } = (await response.json()) as ListDeploymentSpendResponse;

      expect(data.projects.map(({ projectId }) => projectId)).toEqual([staging.id]);
      expect(data.days.map(({ projectId }) => projectId)).toEqual([staging.id, staging.id]);
      expect(data.deployments.map(({ dseq }) => dseq)).toEqual([deployments.web]);
    });

    it("gives a member granted no project an empty report", async () => {
      const { actAs, addMember } = await setup();
      const member = await addMember("member");

      const response = await actAs(member)(`/v1/deployment-spend?${RANGE}`);

      expect(await response.json()).toEqual({ data: { startDate: "2026-09-01", endDate: "2026-09-03", projects: [], days: [], deployments: [] } });
    });

    it("refuses a range whose start comes after its end", async () => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/deployment-spend?startDate=2026-09-03&endDate=2026-09-01");

      expect(response.status).toBe(400);
    });

    it("answers 404 while organizations are off for the caller", async () => {
      const { owner, actAs } = await setup({ organizationsOn: false });

      const response = await actAs(owner)(`/v1/deployment-spend?${RANGE}`);

      expect(response.status).toBe(404);
    });
  });

  async function seedChainDays() {
    chainDays ??= (async () => {
      await initDb();

      for (const day of DAYS) {
        const { id } = await createDay({
          date: day.date,
          firstBlockHeight: day.firstBlockHeight,
          lastBlockHeight: day.lastBlockHeightYet,
          lastBlockHeightYet: day.lastBlockHeightYet,
          aktPrice: 2
        });
        await createAkashBlock({ height: day.firstBlockHeight, datetime: new Date(`${day.date}T00:00:00.000Z`), dayId: id });
        await createAkashBlock({ height: day.lastBlockHeightYet, datetime: new Date(day.lastBlockAt), dayId: id });
      }

      return (await createProvider({ deletedHeight: null })).owner;
    })();

    return await chainDays;
  }

  async function seedChainDeployment(input: { owner: string; leases: Array<{ createdHeight: number; closedHeight?: number }> }) {
    const providerAddress = await seedChainDays();
    const dseq = faker.string.numeric(12);
    const deployment = await createDeployment({ owner: input.owner, dseq, createdHeight: input.leases[0].createdHeight, denom: "uact" });

    for (const lease of input.leases) {
      const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: input.owner, dseq });
      await createLease({
        owner: input.owner,
        dseq,
        providerAddress,
        deploymentId: deployment.id,
        deploymentGroupId: group.id,
        createdHeight: lease.createdHeight,
        closedHeight: lease.closedHeight,
        predictedClosedHeight: "100000",
        price: PRICE_PER_BLOCK,
        denom: "uact"
      });
    }

    return dseq;
  }

  async function seedOrganizationDeployments(input: { organizationId: string; ownerId: string; address: string; stagingId: string; defaultProjectId: string }) {
    const web = await seedChainDeployment({ owner: input.address, leases: [{ createdHeight: 1000, closedHeight: 2480 }] });
    const api = await seedChainDeployment({ owner: input.address, leases: [{ createdHeight: 2000 }, { createdHeight: 2480 }] });
    const unrecorded = await seedChainDeployment({ owner: input.address, leases: [{ createdHeight: 3000, closedHeight: 3240 }] });
    await seedChainDeployment({ owner: createAkashAddress(), leases: [{ createdHeight: 1000 }] });

    await seedDeploymentSetting({ userId: input.ownerId, organizationId: input.organizationId, projectId: input.stagingId, dseq: web });
    await seedDeploymentSetting({ userId: input.ownerId, organizationId: input.organizationId, projectId: input.defaultProjectId, dseq: api, name: "api" });

    return { web, api, unrecorded };
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() };
  }

  async function setup(input: { organizationsOn?: boolean } = {}) {
    const { user: owner, organization: team, project: defaultProject } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const staging = await seedProject({ organizationId: team.id, createdAt: new Date(Date.now() + 1000) });
    const address = createAkashAddress();
    await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("UserWallets"))
      .values({ userId: owner.id, organizationId: team.id, address, deploymentAllowance: "0", feeAllowance: "0", isTrialing: false });
    const deployments = await seedOrganizationDeployments({
      organizationId: team.id,
      ownerId: owner.id,
      address,
      stagingId: staging.id,
      defaultProjectId: defaultProject.id
    });
    const tokens = new Map<string, string>();

    vi.spyOn(container.resolve(UserAuthTokenService), "getValidUserId").mockImplementation(
      async header => tokens.get(header.replace(/^Bearer +/i, "")) ?? null
    );
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false;
    });

    const actAs = (user: UserOutput) => {
      const token = faker.string.alphanumeric(40);
      tokens.set(token, user.userId!);

      return (path: string) => app.request(path, { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id } });
    };

    const addMember = async (role: OrganizationRole) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, owner, staging, defaultProject, deployments, actAs, addMember };
  }
});
