import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { ConnectionError } from "sequelize";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { ListDeploymentsItem, ListDeploymentsQuery } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentClosureState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type {
  DeploymentSettingRepository,
  ReachableDeployment,
  UnclosedReachableDeployment
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { type DeploymentReaderService, MAX_SEARCHABLE_DEPLOYMENTS } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { LeaseGpusByLease, LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { DeploymentListService, UNINDEXED_DEPLOYMENT_GRACE_MINUTES } from "./deployment-list.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(DeploymentListService.name, () => {
  describe("outside organization mode", () => {
    it("lists the caller's wallet as before, with no project on any deployment", async () => {
      const { service, deploymentReaderService, deploymentSettingRepository, user, walletPage } = setup({ context: { mode: "legacy" } });

      const page = await service.list(query({ state: "closed", reverse: true, search: "web", skip: 5, limit: 10, projectId: faker.string.uuid() }));

      expect(page).toBe(walletPage);
      expect(deploymentReaderService.list).toHaveBeenCalledWith({ query: { userId: user.id }, state: "closed", reverse: true, search: "web", skip: 5, limit: 10 });
      expect(deploymentSettingRepository.accessibleBy).not.toHaveBeenCalled();
    });

    it("lists the caller's wallet for a request running in no organization", async () => {
      const { service, walletPage } = setup({ withoutContext: true });

      await expect(service.list(query())).resolves.toBe(walletPage);
    });
  });

  describe("in a personal organization reaching every project", () => {
    it("lists the wallet and adds the project each deployment is filed in, null for one the console holds no row for", async () => {
      const { service, deploymentReaderService, deploymentSettingRepository, scopedSettingRepository, authService, user } = setup({
        context: { organizationType: "personal" }
      });
      const [filed, unrecorded] = [listItem("101"), listItem("102")];
      const projectId = faker.string.uuid();
      deploymentReaderService.list.mockResolvedValue({ deployments: [filed, unrecorded], total: 2, hasMore: false });
      scopedSettingRepository.findProjectIdsByDseqs.mockResolvedValue(new Map([["101", projectId]]));

      const page = await service.list(query({ search: "web" }));

      expect(page).toEqual({ deployments: [{ ...filed, projectId }, { ...unrecorded, projectId: null }], total: 2, hasMore: false });
      expect(deploymentReaderService.list).toHaveBeenCalledWith(expect.objectContaining({ query: { userId: user.id }, search: "web" }));
      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedSettingRepository.findProjectIdsByDseqs).toHaveBeenCalledWith({ userId: user.id, dseqs: ["101", "102"] });
    });

    it.each([
      { case: "a project it names", context: { organizationType: "personal" as const }, projectId: faker.string.uuid() },
      { case: "a request narrowed to one project", context: { organizationType: "personal" as const, projectScope: { kind: "projects" as const, projectIds: ["p"] } } }
    ])("lists from the projects it reaches for $case", async ({ context, projectId }) => {
      const { service, deploymentReaderService, scopedSettingRepository } = setup({ context });

      await service.list(query({ projectId }));

      expect(deploymentReaderService.list).not.toHaveBeenCalled();
      expect(scopedSettingRepository.findUnclosedReachable).toHaveBeenCalled();
    });
  });

  describe("from the projects the caller reaches", () => {
    it("lists nothing, reading nothing, for a role that may read no deployment", async () => {
      const { service, scopedSettingRepository } = setup({ context: { role: "billing" }, canReadDeployments: false });

      await expect(service.list(query())).resolves.toEqual({ deployments: [], total: 0, hasMore: false });
      expect(scopedSettingRepository.findUnclosedReachable).not.toHaveBeenCalled();
    });

    it("reads at most one row past the cap of the unflagged rows the caller reaches, through their own ability and filters", async () => {
      const { service, deploymentSettingRepository, scopedSettingRepository, authService, context } = setup();
      const projectId = faker.string.uuid();

      await service.list(query({ projectId, search: "web" }));

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedSettingRepository.findUnclosedReachable).toHaveBeenCalledWith(
        { organizationId: context.organizationId, projectId, search: "web" },
        { limit: MAX_SEARCHABLE_DEPLOYMENTS + 1, recentMinutes: UNINDEXED_DEPLOYMENT_GRACE_MINUTES }
      );
    });

    it("refuses with 422 when more unflagged rows than the cap would have to be checked, logging it", async () => {
      const { service, scopedSettingRepository, logger, context } = setup({ unclosed: Array.from({ length: MAX_SEARCHABLE_DEPLOYMENTS + 1 }, () => unclosedRow()) });

      await expect(service.list(query({ state: "closed" }))).rejects.toMatchObject({ status: 422 });
      expect(scopedSettingRepository.findReachablePage).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_LIST_TOO_LARGE", organizationId: context.organizationId }));
    });

    it("lists as many unflagged rows as the cap allows", async () => {
      const { service, scopedSettingRepository } = setup({ unclosed: Array.from({ length: MAX_SEARCHABLE_DEPLOYMENTS }, () => unclosedRow()) });

      await service.list(query());

      expect(scopedSettingRepository.findReachablePage).toHaveBeenCalled();
    });

    it("draws an active page from the rows the index holds open and the recent ones it has not seen yet", async () => {
      const [open, closed, recent, stale] = [unclosedRow({ dseq: "1" }), unclosedRow({ dseq: "2" }), unclosedRow({ dseq: "3", isRecent: true }), unclosedRow({ dseq: "4" })];
      const { service, scopedSettingRepository, deploymentRepository, context } = setup({
        unclosed: [open, closed, recent, stale],
        indexedDseqs: ["1", "2"],
        closedDseqs: ["2"]
      });

      await service.list(query({ state: "active", reverse: true, skip: 20, limit: 10, search: "web" }));

      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([open, closed, recent, stale].map(({ owner, dseq }) => ({ owner, dseq })));
      expect(scopedSettingRepository.findReachablePage).toHaveBeenCalledWith({
        organizationId: context.organizationId,
        projectId: undefined,
        search: "web",
        among: { ids: [open.id, recent.id] },
        reverse: true,
        skip: 20,
        limit: 10
      });
    });

    it("draws a closed page from the rows flagged closed and those the index holds closed", async () => {
      const [open, closed, recent] = [unclosedRow({ dseq: "1" }), unclosedRow({ dseq: "2", isRecent: true }), unclosedRow({ dseq: "3", isRecent: true })];
      const { service, scopedSettingRepository } = setup({ unclosed: [open, closed, recent], indexedDseqs: ["1", "2"], closedDseqs: ["2"] });

      await service.list(query({ state: "closed" }));

      expect(scopedSettingRepository.findReachablePage).toHaveBeenCalledWith(expect.objectContaining({ among: { flaggedClosedOrIds: [closed.id] } }));
    });

    it("asks the index for each dseq without leading zeros and still matches it", async () => {
      const padded = unclosedRow({ dseq: "0042" });
      const { service, scopedSettingRepository, deploymentRepository } = setup({ unclosed: [padded], indexedDseqs: ["42"] });

      await service.list(query());

      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([{ owner: padded.owner, dseq: "42" }]);
      expect(scopedSettingRepository.findReachablePage).toHaveBeenCalledWith(expect.objectContaining({ among: { ids: [padded.id] } }));
    });

    it("fails rather than guessing the state when the index cannot be reached", async () => {
      const { service, deploymentRepository, scopedSettingRepository } = setup({ unclosed: [unclosedRow()] });
      deploymentRepository.findClosureStates.mockRejectedValue(new ConnectionError(new Error("connection refused")));

      await expect(service.list(query())).rejects.toBeInstanceOf(ConnectionError);
      expect(scopedSettingRepository.findReachablePage).not.toHaveBeenCalled();
    });

    it.each([
      { skip: 0, limit: 2, total: 3, hasMore: true },
      { skip: 1, limit: 2, total: 3, hasMore: false },
      { skip: 2, limit: 2, total: 3, hasMore: false }
    ])("reports another page after skip $skip and limit $limit of $total only when one is left", async ({ skip, limit, total, hasMore }) => {
      const { service, scopedSettingRepository } = setup();
      scopedSettingRepository.findReachablePage.mockResolvedValue({ deployments: [], total });

      await expect(service.list(query({ skip, limit }))).resolves.toEqual({ deployments: [], total, hasMore });
    });

    it("reads each deployment of the page from the chain by its owner, with the console's settings, gpus and project", async () => {
      const row = reachable({ dseq: "11", setting: { name: "web", closed: false, runtimeLimitHours: 4, runtimeEndsAt: null } });
      const { service, deploymentReaderService, leaseGpuService } = setup({ page: [row] });
      const leaseGpus: LeaseGpusByLease = new Map([["1/1/akash1provider", { offeredGpus: { gpus: [], recordedAt: "2026-10-01T00:00:00.000Z" } }]]);
      leaseGpuService.findForDeploymentSettings.mockResolvedValue(new Map([[row.id, leaseGpus]]));

      const page = await service.list(query());

      const listed = await deploymentReaderService.findListedByOwnerAndDseq.mock.results[0].value;
      expect(deploymentReaderService.findListedByOwnerAndDseq).toHaveBeenCalledWith(row.owner, "11");
      expect(leaseGpuService.findForDeploymentSettings).toHaveBeenCalledWith([row.id]);
      expect(page.deployments).toEqual([
        {
          deployment: listed.deployment.deployment,
          groups: listed.deployment.groups,
          escrow_account: listed.deployment.escrow_account,
          leases: listed.leases,
          name: "web",
          settings: { name: "web", closed: false, runtimeLimitHours: 4, runtimeEndsAt: null },
          projectId: row.projectId
        }
      ]);
    });

    it("keeps the page's order and leaves out a deployment the chain no longer holds", async () => {
      const [first, gone, last] = [reachable({ dseq: "1" }), reachable({ dseq: "2" }), reachable({ dseq: "3" })];
      const { service, deploymentReaderService } = setup({ page: [first, gone, last] });
      const findListed = deploymentReaderService.findListedByOwnerAndDseq.getMockImplementation()!;
      deploymentReaderService.findListedByOwnerAndDseq.mockImplementation(async (owner, dseq) => (dseq === "2" ? null : await findListed(owner, dseq)));

      const page = await service.list(query());

      expect(page.deployments.map(({ deployment }) => deployment.id.dseq)).toEqual(["1", "3"]);
    });

    it("fails the list when a deployment of the page cannot be read", async () => {
      const { service, deploymentReaderService } = setup({ page: [reachable()] });
      deploymentReaderService.findListedByOwnerAndDseq.mockRejectedValue(new Error("chain refused"));

      await expect(service.list(query())).rejects.toThrow("chain refused");
    });
  });

  function query(overrides: Partial<ListDeploymentsQuery> = {}): ListDeploymentsQuery {
    return { state: "active", reverse: false, skip: 0, limit: 10, ...overrides };
  }

  function unclosedRow(overrides: Partial<UnclosedReachableDeployment> = {}): UnclosedReachableDeployment {
    return { id: faker.string.uuid(), dseq: faker.string.numeric(8), owner: createAkashAddress(), isRecent: false, ...overrides };
  }

  function reachable(overrides: Partial<ReachableDeployment> = {}): ReachableDeployment {
    return {
      id: faker.string.uuid(),
      dseq: faker.string.numeric(8),
      owner: createAkashAddress(),
      projectId: faker.string.uuid(),
      setting: { name: null, closed: false, runtimeLimitHours: null, runtimeEndsAt: null },
      ...overrides
    };
  }

  function listItem(dseq: string): ListDeploymentsItem {
    const info = createDeploymentInfoSeed({ dseq });

    return { ...info, leases: [], name: null, settings: null };
  }

  function setup(
    input: {
      context?: Partial<OrganizationContext>;
      withoutContext?: boolean;
      canReadDeployments?: boolean;
      unclosed?: UnclosedReachableDeployment[];
      indexedDseqs?: string[];
      closedDseqs?: string[];
      page?: ReachableDeployment[];
    } = {}
  ) {
    const user = createUser();
    const context = createOrganizationContext(input.context);
    const ability = createMongoAbility<MongoAbility>(
      input.canReadDeployments === false ? [] : [{ action: "read", subject: "DeploymentSetting", conditions: { organizationId: context.organizationId } }]
    );
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>();
    executionContextService.hasContext.mockReturnValue(!input.withoutContext);
    executionContextService.get.calledWith("ORGANIZATION_CONTEXT").mockReturnValue(context);

    const walletPage = { deployments: [], total: 0, hasMore: false };
    const deploymentReaderService = mock<DeploymentReaderService>();
    deploymentReaderService.list.mockResolvedValue(walletPage);
    deploymentReaderService.findListedByOwnerAndDseq.mockImplementation(async (owner, dseq) => ({
      deployment: createDeploymentInfoSeed({ owner, dseq }),
      leases: [createLeaseApiResponse({ owner, dseq }).lease]
    }));

    const scopedSettingRepository = mock<DeploymentSettingRepository>();
    scopedSettingRepository.findUnclosedReachable.mockResolvedValue(input.unclosed ?? []);
    scopedSettingRepository.findReachablePage.mockResolvedValue({ deployments: input.page ?? [], total: input.page?.length ?? 0 });
    scopedSettingRepository.findProjectIdsByDseqs.mockResolvedValue(new Map());
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scopedSettingRepository);

    const deploymentRepository = mock<DeploymentRepository>();
    deploymentRepository.findClosureStates.mockImplementation(async keys =>
      keys
        .filter(({ dseq }) => (input.indexedDseqs ?? []).includes(dseq))
        .map((key): DeploymentClosureState => ({ ...key, isClosed: (input.closedDseqs ?? []).includes(key.dseq) }))
    );

    const leaseGpuService = mock<LeaseGpuService>();
    leaseGpuService.findForDeploymentSettings.mockResolvedValue(new Map());
    const logger = mock<ReturnType<CreateLogger>>();

    const service = new DeploymentListService(
      deploymentReaderService,
      deploymentSettingRepository,
      deploymentRepository,
      leaseGpuService,
      authService,
      executionContextService,
      vi.fn<CreateLogger>(() => logger)
    );

    return {
      service,
      user,
      context,
      authService,
      walletPage,
      logger,
      deploymentReaderService,
      deploymentSettingRepository,
      scopedSettingRepository,
      deploymentRepository,
      leaseGpuService
    };
  }
});
