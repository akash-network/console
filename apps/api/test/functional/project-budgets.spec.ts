import { faker } from "@faker-js/faker";
import { and, eq } from "drizzle-orm";
import nock from "nock";
import fs from "node:fs";
import path from "node:path";
import { container } from "tsyringe";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { startJobQueues } from "@src/app/providers/jobs.provider";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { AuthService } from "@src/auth/services/auth.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import { BILLING_CONFIG } from "@src/billing/providers";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG, JOB_NAME, POSTGRES_DB, resolveTable } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { ListProjectBudgetsResponse, ProjectBudgetResponse } from "@src/organization/http-schemas/project-budget.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { ProjectBudgetAlert } from "@src/organization/services/project-budget-alert/project-budget-alert.handler";
import { app } from "@src/rest-app";
import type { UserOutput } from "@src/user/repositories";

import { findDeploymentDepositsOf } from "@test/seeders/db/deployment-deposit.seeder";
import { seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentGrantResponseSeed } from "@test/seeders/deployment-grant-response.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createDeploymentListResponseSeed } from "@test/seeders/deployment-list-response.seeder";
import { createFeeAllowanceResponse } from "@test/seeders/fee-allowance-response.seeder";
import { findJobRows } from "@test/services/job-queue-harness";
import { WalletTestingService } from "@test/services/wallet-testing.service";

/** 5 AKT priced at $2: every top-up below commits $10. */
const TOP_UP_AKT = 5;
const AKT_PRICE_USD = 2;
const GRANTED_UDENOM = 50_000_000;

const SDL = fs.readFileSync(path.resolve(__dirname, "../mocks/hello-world-sdl.yml"), "utf8");

describe("Project budgets", () => {
  const walletService = new WalletTestingService(app);

  beforeAll(async () => {
    await startJobQueues();
  }, 20_000);

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    await container.dispose();
  });

  describe("budget management", () => {
    it("lets an owner set a budget whose alert threshold and top-up stop default to 80% and off", async () => {
      const { project, owner, actAs } = await setupTeam();

      const response = await actAs(owner)("/v1/project-budgets", { method: "POST", body: { data: { projectId: project.id, monthlyAmountUsd: 250.5 } } });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        data: {
          id: expect.any(String),
          projectId: project.id,
          monthlyAmountUsd: 250.5,
          alertThresholdPercent: 80,
          stopTopUps: false,
          currentPeriod: { startDate: expect.stringMatching(/-01$/), endDate: expect.any(String), committedUsd: 0 },
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      });
    });

    it("answers 409 for a second budget on the same project", async () => {
      const { project, owner, actAs } = await setupTeam();
      const create = () => actAs(owner)("/v1/project-budgets", { method: "POST", body: { data: { projectId: project.id, monthlyAmountUsd: 10 } } });

      expect((await create()).status).toBe(201);
      const second = await create();

      expect(second.status).toBe(409);
      expect(await second.json()).toMatchObject({ code: "project_budget_exists" });
    });

    it("lets an admin change and remove a budget", async () => {
      const { project, owner, actAs, addMember } = await setupTeam();
      const admin = await addMember("admin");
      const budget = await createBudget(actAs(owner), project.id);

      const updated = await actAs(admin)(`/v1/project-budgets/${budget.id}`, {
        method: "PATCH",
        body: { data: { stopTopUps: true, alertThresholdPercent: 50 } }
      });
      const removed = await actAs(admin)(`/v1/project-budgets/${budget.id}`, { method: "DELETE" });
      const removedAgain = await actAs(admin)(`/v1/project-budgets/${budget.id}`, { method: "DELETE" });

      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({ data: { stopTopUps: true, alertThresholdPercent: 50 } });
      expect(removed.status).toBe(204);
      expect(removedAgain.status).toBe(404);
    });

    it("lets the billing role read every budget but change none", async () => {
      const { project, owner, actAs, addMember } = await setupTeam();
      const billing = await addMember("billing");
      const budget = await createBudget(actAs(owner), project.id);

      const list = await actAs(billing)("/v1/project-budgets");
      const update = await actAs(billing)(`/v1/project-budgets/${budget.id}`, { method: "PATCH", body: { data: { stopTopUps: true } } });
      const create = await actAs(billing)("/v1/project-budgets", { method: "POST", body: { data: { projectId: project.id, monthlyAmountUsd: 1 } } });

      expect(((await list.json()) as ListProjectBudgetsResponse).data.map(({ id }) => id)).toEqual([budget.id]);
      expect(update.status).toBe(403);
      expect(create.status).toBe(403);
    });

    it("lets a project admin read the budget of its project only, and a project member read none", async () => {
      const { team, project, otherProject, owner, actAs, addMember } = await setupTeam();
      const projectAdmin = await addMember("member");
      const projectMember = await addMember("member");
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: projectAdmin.id, role: "admin" });
      await seedProjectMember({ organizationId: team.id, projectId: project.id, userId: projectMember.id, role: "member" });
      const budget = await createBudget(actAs(owner), project.id);
      await createBudget(actAs(owner), otherProject.id);

      const adminList = await actAs(projectAdmin)("/v1/project-budgets");
      const adminUpdate = await actAs(projectAdmin)(`/v1/project-budgets/${budget.id}`, { method: "PATCH", body: { data: { monthlyAmountUsd: 5000 } } });
      const memberList = await actAs(projectMember)("/v1/project-budgets");

      expect(((await adminList.json()) as ListProjectBudgetsResponse).data.map(({ id }) => id)).toEqual([budget.id]);
      expect(adminUpdate.status).toBe(403);
      expect(await memberList.json()).toEqual({ data: [] });
    });

    it.each([
      { case: "a project header", narrowing: "header" as const },
      { case: "an API key bound to the project", narrowing: "key" as const }
    ])("keeps an owner whose request is narrowed by $case to that project's budget", async ({ narrowing }) => {
      const { team, project, otherProject, owner, actAs } = await setupTeam();
      const budget = await createBudget(actAs(owner), project.id);
      const otherBudget = await createBudget(actAs(owner), otherProject.id);
      const asOwner = actAs(owner);
      const request =
        narrowing === "key"
          ? await keyBoundTo({ userId: owner.id, organizationId: team.id, projectId: project.id })
          : (path: string, init: { method?: string; body?: unknown } = {}) => asOwner(path, { ...init, headers: { "x-project-id": project.id } });

      const list = await request("/v1/project-budgets");
      const updateOther = await request(`/v1/project-budgets/${otherBudget.id}`, { method: "PATCH", body: { data: { monthlyAmountUsd: 5000 } } });
      const updateOwn = await request(`/v1/project-budgets/${budget.id}`, { method: "PATCH", body: { data: { monthlyAmountUsd: 5000 } } });

      expect(((await list.json()) as ListProjectBudgetsResponse).data.map(({ id }) => id)).toEqual([budget.id]);
      expect(updateOther.status).toBe(404);
      expect(updateOwn.status).toBe(200);
    });

    it("refuses an amount below a dollar or with fractions of a cent", async () => {
      const { project, owner, actAs } = await setupTeam();

      const responses = await Promise.all(
        [0.5, 10.005].map(monthlyAmountUsd =>
          actAs(owner)("/v1/project-budgets", { method: "POST", body: { data: { projectId: project.id, monthlyAmountUsd } } })
        )
      );

      expect(responses.map(({ status }) => status)).toEqual([400, 400]);
    });

    it("answers 404 on every budget route while organizations are off for the caller", async () => {
      const { project, owner, actAs } = await setupTeam({ organizationsOn: false });

      const responses = await Promise.all([
        actAs(owner)("/v1/project-budgets"),
        actAs(owner)("/v1/project-budgets", { method: "POST", body: { data: { projectId: project.id, monthlyAmountUsd: 10 } } }),
        actAs(owner)(`/v1/project-budgets/${faker.string.uuid()}`, { method: "PATCH", body: { data: { stopTopUps: true } } }),
        actAs(owner)(`/v1/project-budgets/${faker.string.uuid()}`, { method: "DELETE" })
      ]);

      expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    });
  });

  describe("POST /v1/deployments into a budgeted project", () => {
    it("alerts once when a create crosses the threshold, then refuses the create that would go past the budget", async () => {
      const { createDeployment, budgetOn, defaultProject, organizationId, createDepositCents } = await setupSigner();
      await budgetOn(defaultProject.id, { monthlyAmountCents: Math.ceil(createDepositCents * 1.5), alertThresholdPercent: 50 });

      const first = await createDeployment();
      const alertsAfterFirst = await alertsFor(defaultProject.id);
      const second = await createDeployment();

      expect(first.status).toBe(201);
      expect(alertsAfterFirst).toHaveLength(1);
      expect(second.status).toBe(403);
      expect(await second.json()).toMatchObject({ code: "project_budget_exceeded", data: { projectIds: [defaultProject.id] } });
      expect(await alertsFor(defaultProject.id)).toHaveLength(1);
      expect((await findDeploymentDepositsOf(organizationId)).map(({ status, amountCents }) => ({ status, amountCents }))).toEqual([
        { status: "confirmed", amountCents: createDepositCents }
      ]);
    });

    it("lets only one of two concurrent creates through when the budget fits one", async () => {
      const { createDeployment, budgetOn, defaultProject, createDepositCents } = await setupSigner();
      await budgetOn(defaultProject.id, { monthlyAmountCents: Math.ceil(createDepositCents * 1.5) });

      const responses = await Promise.all([createDeployment(), createDeployment()]);

      expect(responses.map(({ status }) => status).sort()).toEqual([201, 403]);
    });

    it("checks nothing while organizations are off for the user", async () => {
      const { createDeployment, budgetOn, defaultProject, organizationId, createDepositCents } = await setupSigner({ organizationsOn: false });
      await budgetOn(defaultProject.id, { monthlyAmountCents: Math.floor(createDepositCents / 2) });

      const response = await createDeployment();

      expect(response.status).toBe(201);
      expect(await alertsFor(defaultProject.id)).toEqual([]);
      expect(await findDeploymentDepositsOf(organizationId)).toEqual([expect.objectContaining({ status: "confirmed" })]);
    });
  });

  describe("POST /v1/deposit-deployment into a budgeted project", () => {
    it("keeps topping up running deployments past the budget unless the budget stops top-ups", async () => {
      const { topUp, budgetOn, defaultProject, setStopTopUps } = await setupSigner();
      const budgetId = await budgetOn(defaultProject.id, { monthlyAmountCents: 500 });

      const whileOff = await topUp();
      await setStopTopUps(budgetId, true);
      const onceOn = await topUp();

      expect(whileOff.status).toBe(200);
      expect(onceOn.status).toBe(403);
      expect(await onceOn.json()).toMatchObject({ code: "project_budget_exceeded" });
    });
  });

  async function alertsFor(projectId: string) {
    return await findJobRows(ProjectBudgetAlert[JOB_NAME], { data: { projectId } });
  }

  async function createBudget(request: ReturnType<Awaited<ReturnType<typeof setupTeam>>["actAs"]>, projectId: string): Promise<{ id: string }> {
    const response = await request("/v1/project-budgets", { method: "POST", body: { data: { projectId, monthlyAmountUsd: 100 } } });

    return ((await response.json()) as ProjectBudgetResponse).data;
  }

  function createSignedUpUserInput() {
    return { userId: `auth0|${faker.string.alphanumeric(24)}`, username: `user-${faker.string.alphanumeric(12)}`, email: faker.internet.email() };
  }

  async function setupTeam(input: { organizationsOn?: boolean } = {}) {
    const { user: owner, organization: team } = await seedOrganizationWithOwner({ user: createSignedUpUserInput() });
    const project = await seedProject({ organizationId: team.id });
    const otherProject = await seedProject({ organizationId: team.id });
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

      return (requestPath: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) =>
        app.request(requestPath, {
          method: init.method ?? "GET",
          headers: { authorization: `Bearer ${token}`, "x-organization-id": team.id, "content-type": "application/json", ...init.headers },
          body: init.body === undefined ? undefined : JSON.stringify(init.body)
        });
    };

    const addMember = async (role: OrganizationRole) => {
      const user = await seedUser(createSignedUpUserInput());
      await seedOrganizationMember({ organizationId: team.id, userId: user.id, role });

      return user;
    };

    return { team, project, otherProject, owner, actAs, addMember };
  }

  async function keyBoundTo(input: { userId: string; organizationId: string; projectId: string }) {
    const apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    const apiKey = apiKeyGenerator.generateApiKey();
    await container.resolve(ApiKeyRepository).create({
      ...input,
      hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
      keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey),
      name: "ci"
    });

    return (requestPath: string, init: { method?: string; body?: unknown } = {}) =>
      app.request(requestPath, {
        method: init.method ?? "GET",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body)
      });
  }

  async function setupSigner(input: { organizationsOn?: boolean } = {}) {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    answerSigner();
    const { user, token, wallet } = await walletService.createUserAndWallet();
    const { organizationId, defaultProject } = await personalOrganizationOf(user.id);

    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation((flag, context) => {
      if (flag === FeatureFlags.ORGANIZATIONS_ENFORCE) return false;
      if (flag !== FeatureFlags.ORGANIZATIONS) return true;

      return input.organizationsOn !== false && (context?.userId ?? container.resolve(AuthService).safeCurrentUser?.id) === user.id;
    });
    vi.spyOn(container.resolve(DenomExchangeService), "getExchangeRateToUSD").mockResolvedValue({
      price: AKT_PRICE_USD,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    });
    const runningDseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    await seedDeploymentSetting({ userId: user.id, organizationId, projectId: defaultProject.id, dseq: runningDseq });
    answerChain(wallet.address, runningDseq);

    const request = (requestPath: string, data: Record<string, unknown>) =>
      app.request(requestPath, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ data })
      });
    const createDeployment = () => request("/v1/deployments", { sdl: SDL });
    const topUp = () => request("/v1/deposit-deployment", { dseq: runningDseq, deposit: TOP_UP_AKT });
    const createDepositCents = Math.round(container.resolve(DeploymentConfigService).get("DEPLOYMENT_DEFAULT_DEPOSIT") * AKT_PRICE_USD * 100);

    const budgetOn = async (projectId: string, settings: { monthlyAmountCents: number; alertThresholdPercent?: number }) => {
      const [budget] = await db
        .insert(resolveTable("ProjectBudgets"))
        .values({ organizationId, projectId, ...settings })
        .returning();

      return budget.id;
    };

    const setStopTopUps = async (budgetId: string, stopTopUps: boolean) => {
      const budgets = resolveTable("ProjectBudgets");
      await db.update(budgets).set({ stopTopUps }).where(eq(budgets.id, budgetId));
    };

    return { createDeployment, topUp, budgetOn, setStopTopUps, defaultProject, organizationId, createDepositCents };
  }

  async function personalOrganizationOf(userId: string) {
    const [members, projects] = [resolveTable("OrganizationMembers"), resolveTable("Projects")];
    const [row] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .select({ organizationId: members.organizationId, defaultProject: projects })
      .from(members)
      .innerJoin(projects, and(eq(projects.organizationId, members.organizationId), eq(projects.isDefault, true)))
      .where(eq(members.userId, userId));

    return row;
  }

  function answerSigner() {
    nock(container.resolve(BILLING_CONFIG).TX_SIGNER_BASE_URL)
      .persist()
      .post("/v1/tx/funding")
      .reply(200, { data: { code: 0, hash: "FUNDING_HASH", rawLog: "[]" } })
      .post("/v1/tx/derived")
      .reply(200, () => ({ data: { code: 0, hash: faker.string.hexadecimal({ length: 64, prefix: "" }), rawLog: "[]" } }));
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .get(/\/cosmos\/feegrant\/v1beta1\/allowances\/.*/)
      .once()
      .reply(200, { allowances: [createFeeAllowanceResponse()] });
  }

  function answerChain(address: string, runningDseq: string) {
    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, createFeeAllowanceResponse({ grantee: address, amount: "5000000" }))
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, createDeploymentGrantResponseSeed({ grantee: address, amount: String(GRANTED_UDENOM), grantType: "/akash.escrow.v1.DepositAuthorization" }))
      .get(/\/akash\/deployment\/.*\/deployments\/list\?.*/)
      .reply(200, createDeploymentListResponseSeed({ owner: address }))
      .get(uri => uri.includes("/deployments/info") && uri.includes(runningDseq))
      .reply(200, createDeploymentInfoSeed({ owner: address, dseq: runningDseq }))
      .get(uri => uri.includes("/leases/list"))
      .reply(200, { leases: [], pagination: { next_key: null, total: "0" } })
      .get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      .reply(200, { block: { header: { height: "1000" } } });
  }
});
