import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { app, initDb } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { createAkashAddress, createAkashBlock, createAkashMessage, createDay, createDeployment, createDeploymentGroup, createLease, createProvider, createTransaction } from "@test/seeders";
import { seedDeploymentDeposit } from "@test/seeders/db/deployment-deposit.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

const RANGE = "startDate=2026-09-01&endDate=2026-09-03";

const DAYS = [
  { date: "2026-09-01", firstBlockHeight: 1000, lastBlockHeightYet: 1999 },
  { date: "2026-09-02", firstBlockHeight: 2000, lastBlockHeightYet: 2999 },
  { date: "2026-09-03", firstBlockHeight: 3000, lastBlockHeightYet: 3999 }
];

const PRICE_PER_BLOCK = 10_000;

const NOTHING_SPENT = { committedUsd: 0, consumedUsd: 0, estimatedConsumedUsd: 0 };

describe("Project spend", () => {
  let chainDays: Promise<string> | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("GET /v1/project-spend", () => {
    it("gives an owner each project's committed and consumed spend, the unassigned remainder and a total they add up to", async () => {
      const { team, owner, staging, defaultProject, actAs } = await setup();

      const response = await actAs(owner)(`/v1/project-spend?${RANGE}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          startDate: "2026-09-01",
          endDate: "2026-09-03",
          isEstimated: true,
          projects: [
            { projectId: defaultProject.id, name: defaultProject.name, isDefault: true, isDeleted: false, committedUsd: 6, consumedUsd: 19.98, estimatedConsumedUsd: 14.98 },
            { projectId: staging.id, name: staging.name, isDefault: false, isDeleted: false, committedUsd: 7, consumedUsd: 14.99, estimatedConsumedUsd: 0 }
          ],
          unassigned: { committedUsd: 1, consumedUsd: 5, estimatedConsumedUsd: 0 },
          total: { committedUsd: 14, consumedUsd: 39.97, estimatedConsumedUsd: 14.98 }
        }
      });
      expect(team.id).toBeDefined();
    });

    it("gives the billing role every project and the organization's figures", async () => {
      const { staging, defaultProject, actAs, addMember } = await setup();
      const billing = await addMember("billing");

      const response = await actAs(billing)(`/v1/project-spend?${RANGE}`);
      const { data } = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects.map(({ projectId }: { projectId: string }) => projectId)).toEqual([defaultProject.id, staging.id]);
      expect(data.total).toEqual({ committedUsd: 14, consumedUsd: 39.97, estimatedConsumedUsd: 14.98 });
    });

    it("gives a member granted one project only that project, without the organization's figures", async () => {
      const { team, staging, actAs, addMember } = await setup();
      const member = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: staging.id, userId: member.id, role: "member" });

      const response = await actAs(member)(`/v1/project-spend?${RANGE}`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          startDate: "2026-09-01",
          endDate: "2026-09-03",
          isEstimated: false,
          projects: [{ projectId: staging.id, name: staging.name, isDefault: false, isDeleted: false, committedUsd: 7, consumedUsd: 14.99, estimatedConsumedUsd: 0 }],
          unassigned: null,
          total: null
        }
      });
    });

    it("gives a viewer the projects it was granted to read", async () => {
      const { team, defaultProject, actAs, addMember } = await setup();
      const viewer = await addMember("viewer");
      await seedProjectMember({ organizationId: team.id, projectId: defaultProject.id, userId: viewer.id, role: "viewer" });

      const response = await actAs(viewer)(`/v1/project-spend?${RANGE}`);
      const { data } = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toEqual([expect.objectContaining({ projectId: defaultProject.id, committedUsd: 6, consumedUsd: 19.98 })]);
      expect(data.total).toBeNull();
    });

    it("gives a member granted no project an empty report", async () => {
      const { actAs, addMember } = await setup();
      const member = await addMember("member");

      const response = await actAs(member)(`/v1/project-spend?${RANGE}`);

      expect(await response.json()).toEqual({
        data: { startDate: "2026-09-01", endDate: "2026-09-03", isEstimated: false, projects: [], unassigned: null, total: null }
      });
    });

    it("keeps an owner who narrows the request to one project to that project", async () => {
      const { owner, staging, actAs } = await setup();

      const response = await actAs(owner)(`/v1/project-spend?${RANGE}`, { headers: { "x-project-id": staging.id } });
      const { data } = await response.json();

      expect(data.projects.map(({ projectId }: { projectId: string }) => projectId)).toEqual([staging.id]);
      expect(data.unassigned).toBeNull();
      expect(data.total).toBeNull();
    });

    it("reports a range with no spend as zeros", async () => {
      const { owner, actAs } = await setup();

      const response = await actAs(owner)("/v1/project-spend?startDate=2026-06-01&endDate=2026-06-30");
      const { data } = await response.json();

      expect(data.total).toEqual(NOTHING_SPENT);
      expect(data.isEstimated).toBe(false);
    });

    it("refuses a range whose start comes after its end or that spans more than a year", async () => {
      const { owner, actAs } = await setup();

      const responses = await Promise.all([
        actAs(owner)("/v1/project-spend?startDate=2026-09-03&endDate=2026-09-01"),
        actAs(owner)("/v1/project-spend?startDate=2025-01-01&endDate=2026-09-01"),
        actAs(owner)("/v1/project-spend?startDate=yesterday")
      ]);

      expect(responses.map(({ status }) => status)).toEqual([400, 400, 400]);
    });

    it("answers 404 while organizations are off for the caller", async () => {
      const { owner, actAs } = await setup({ organizationsOn: false });

      const response = await actAs(owner)(`/v1/project-spend?${RANGE}`);

      expect(response.status).toBe(404);
    });
  });

  async function seedChainDays() {
    chainDays ??= (async () => {
      await initDb();

      for (const day of DAYS) {
        const { id } = await createDay({ date: day.date, firstBlockHeight: day.firstBlockHeight, lastBlockHeight: day.lastBlockHeightYet, lastBlockHeightYet: day.lastBlockHeightYet, aktPrice: 2 });
        await createAkashBlock({ height: day.firstBlockHeight, datetime: new Date(`${day.date}T00:00:00.000Z`), dayId: id });
      }

      return (await createProvider({ deletedHeight: null })).owner;
    })();

    return await chainDays;
  }

  async function seedChainDeployment(input: {
    owner: string;
    dseq: string;
    createdHeight: number;
    deposit: number;
    lease: { createdHeight: number; closedHeight?: number; predictedClosedHeight?: string };
    lastWithdrawHeight?: number;
  }) {
    const providerAddress = await seedChainDays();
    const deployment = await createDeployment({
      owner: input.owner,
      dseq: input.dseq,
      createdHeight: input.createdHeight,
      deposit: input.deposit,
      denom: "uact",
      lastWithdrawHeight: input.lastWithdrawHeight ?? input.createdHeight
    });
    const group = await createDeploymentGroup({ deploymentId: deployment.id, owner: input.owner, dseq: input.dseq });
    await createLease({
      owner: input.owner,
      dseq: input.dseq,
      providerAddress,
      deploymentId: deployment.id,
      deploymentGroupId: group.id,
      createdHeight: input.lease.createdHeight,
      closedHeight: input.lease.closedHeight,
      predictedClosedHeight: input.lease.predictedClosedHeight ?? "100000",
      price: PRICE_PER_BLOCK,
      denom: "uact"
    });

    return deployment;
  }

  async function seedOrganizationSpend(input: { organizationId: string; ownerId: string; address: string; stagingId: string; defaultProjectId: string }) {
    const [stagingDseq, defaultDseq, unrecordedDseq] = [faker.string.numeric(12), faker.string.numeric(12), faker.string.numeric(12)];

    const staging = await seedChainDeployment({
      owner: input.address,
      dseq: stagingDseq,
      createdHeight: 1000,
      deposit: 7_000_000,
      lease: { createdHeight: 1000, closedHeight: 2500 }
    });
    const topUp = await createTransaction({ height: 2000 });
    await createAkashMessage({ txId: topUp.id, height: 2000, type: "/akash.escrow.v1.MsgAccountDeposit", amount: "2000000", relatedDeploymentId: staging.id });
    await seedChainDeployment({
      owner: input.address,
      dseq: defaultDseq,
      createdHeight: 2000,
      deposit: 3_000_000,
      lastWithdrawHeight: 2500,
      lease: { createdHeight: 2000 }
    });
    await seedChainDeployment({
      owner: input.address,
      dseq: unrecordedDseq,
      createdHeight: 3000,
      deposit: 1_000_000,
      lease: { createdHeight: 3000, closedHeight: 3500 }
    });
    await seedChainDeployment({ owner: createAkashAddress(), dseq: faker.string.numeric(12), createdHeight: 1000, deposit: 9_000_000, lease: { createdHeight: 1000 } });

    await seedDeploymentSetting({ userId: input.ownerId, organizationId: input.organizationId, projectId: input.stagingId, dseq: stagingDseq });
    await seedDeploymentSetting({ userId: input.ownerId, organizationId: input.organizationId, projectId: input.defaultProjectId, dseq: defaultDseq });
    await seedDeploymentDeposit({
      organizationId: input.organizationId,
      projectId: input.defaultProjectId,
      dseq: defaultDseq,
      amountCents: 300,
      createdAt: new Date("2026-09-02T12:00:00.000Z")
    });
    await seedDeploymentDeposit({ organizationId: input.organizationId, amountCents: 100, createdAt: new Date("2026-09-03T06:00:00.000Z") });
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
    await seedOrganizationSpend({ organizationId: team.id, ownerId: owner.id, address, stagingId: staging.id, defaultProjectId: defaultProject.id });
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

      return (path: string, init: { headers?: Record<string, string> } = {}) =>
        app.request(path, { headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id, ...init.headers } });
    };

    const addMember = async (role: OrganizationRole) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, owner, staging, defaultProject, actAs, addMember };
  }
});
