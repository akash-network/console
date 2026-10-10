import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { ListDeploymentsItem, ListDeploymentsQuery } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentClosureState, DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { DeploymentSettingRepository, ReachableDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { LeaseGpusByLease, LeaseGpuService } from "@src/deployment/services/lease-gpu/lease-gpu.service";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import { DeploymentListService } from "./deployment-list.service";

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
      expect(scopedSettingRepository.findReachable).toHaveBeenCalled();
    });
  });

  describe("from the projects the caller reaches", () => {
    it("lists nothing, reading nothing, for a role that may read no deployment", async () => {
      const { service, scopedSettingRepository } = setup({ context: { role: "billing" }, canReadDeployments: false });

      await expect(service.list(query())).resolves.toEqual({ deployments: [], total: 0, hasMore: false });
      expect(scopedSettingRepository.findReachable).not.toHaveBeenCalled();
    });

    it("asks for the rows of the active organization the caller reaches through their own ability, with the project and search filters", async () => {
      const { service, deploymentSettingRepository, scopedSettingRepository, authService, context } = setup();
      const projectId = faker.string.uuid();

      await service.list(query({ projectId, search: "web" }));

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedSettingRepository.findReachable).toHaveBeenCalledWith({ organizationId: context.organizationId, projectId, search: "web" });
    });

    it("keeps the deployments the chain index holds in the requested state, leaving out those it has not indexed", async () => {
      const [open, closed, unindexed] = [reachable({ dseq: "1" }), reachable({ dseq: "2" }), reachable({ dseq: "3" })];
      const { service, deploymentRepository } = setup({ reachable: [open, closed, unindexed], closedDseqs: ["2"], indexedDseqs: ["1", "2"] });

      const [active, archived] = [await service.list(query({ state: "active" })), await service.list(query({ state: "closed" }))];

      expect(dseqsOf(active)).toEqual(["1"]);
      expect(dseqsOf(archived)).toEqual(["2"]);
      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([open, closed, unindexed].map(({ owner, dseq }) => ({ owner, dseq })));
    });

    it("asks the index for each dseq without leading zeros and still matches it", async () => {
      const padded = reachable({ dseq: "0042" });
      const { service, deploymentRepository } = setup({ reachable: [padded], indexedDseqs: ["42"] });

      const page = await service.list(query());

      expect(deploymentRepository.findClosureStates).toHaveBeenCalledWith([{ owner: padded.owner, dseq: "42" }]);
      expect(dseqsOf(page)).toEqual(["0042"]);
    });

    it("orders by dseq as a number, newest first when reversed", async () => {
      const rows = ["100", "9", "10"].map(dseq => reachable({ dseq }));
      const { service } = setup({ reachable: rows, indexedDseqs: ["100", "9", "10"] });

      const [oldestFirst, newestFirst] = [await service.list(query()), await service.list(query({ reverse: true }))];

      expect(dseqsOf(oldestFirst)).toEqual(["9", "10", "100"]);
      expect(dseqsOf(newestFirst)).toEqual(["100", "10", "9"]);
    });

    it("orders deployments of different owners sharing a dseq by owner", async () => {
      const [later, earlier] = [reachable({ dseq: "7", owner: "akash1b" }), reachable({ dseq: "7", owner: "akash1a" })];
      const { service } = setup({ reachable: [later, earlier], indexedDseqs: ["7"] });

      const page = await service.list(query());

      expect(page.deployments.map(({ deployment }) => deployment.id.owner)).toEqual(["akash1a", "akash1b"]);
    });

    it("pages the matching deployments and counts all of them", async () => {
      const rows = ["1", "2", "3", "4", "5"].map(dseq => reachable({ dseq }));
      const { service, deploymentReaderService } = setup({ reachable: rows, indexedDseqs: ["1", "2", "3", "4", "5"] });

      const [middle, last] = [await service.list(query({ skip: 2, limit: 2 })), await service.list(query({ skip: 4, limit: 2 }))];

      expect(middle).toMatchObject({ total: 5, hasMore: true });
      expect(dseqsOf(middle)).toEqual(["3", "4"]);
      expect(last).toMatchObject({ total: 5, hasMore: false });
      expect(dseqsOf(last)).toEqual(["5"]);
      expect(deploymentReaderService.findListedByOwnerAndDseq).toHaveBeenCalledTimes(3);
    });

    it("lists a deployment two rows of the organization file only once, as the first row files it", async () => {
      const owner = createAkashAddress();
      const [first, second] = [reachable({ dseq: "8", owner }), reachable({ dseq: "8", owner })];
      const { service } = setup({ reachable: [first, second], indexedDseqs: ["8"] });

      const page = await service.list(query());

      expect(page).toMatchObject({ total: 1, deployments: [{ projectId: first.projectId }] });
    });

    it("reads each deployment of the page from the chain by its owner, with the console's settings, gpus and project", async () => {
      const row = reachable({ dseq: "11", setting: { name: "web", closed: false, runtimeLimitHours: 4, runtimeEndsAt: null } });
      const { service, deploymentReaderService, leaseGpuService } = setup({ reachable: [row], indexedDseqs: ["11"] });
      const onChain = deploymentReaderService.findListedByOwnerAndDseq.mock.results;
      const leaseGpus: LeaseGpusByLease = new Map([["1/1/akash1provider", { offeredGpus: { gpus: [], recordedAt: "2026-10-01T00:00:00.000Z" } }]]);
      leaseGpuService.findForDeploymentSettings.mockResolvedValue(new Map([[row.id, leaseGpus]]));

      const page = await service.list(query());

      const listed = await onChain[0].value;
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

    it("leaves out a deployment of the page the chain no longer holds", async () => {
      const [gone, kept] = [reachable({ dseq: "1" }), reachable({ dseq: "2" })];
      const { service, deploymentReaderService } = setup({ reachable: [gone, kept], indexedDseqs: ["1", "2"] });
      deploymentReaderService.findListedByOwnerAndDseq.mockResolvedValueOnce(null);

      const page = await service.list(query());

      expect(dseqsOf(page)).toEqual(["2"]);
    });
  });

  function query(overrides: Partial<ListDeploymentsQuery> = {}): ListDeploymentsQuery {
    return { state: "active", reverse: false, skip: 0, limit: 10, ...overrides };
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

  function dseqsOf(page: { deployments: ListDeploymentsItem[] }) {
    return page.deployments.map(({ deployment }) => deployment.id.dseq);
  }

  function setup(
    input: {
      context?: Partial<OrganizationContext>;
      withoutContext?: boolean;
      canReadDeployments?: boolean;
      reachable?: ReachableDeployment[];
      indexedDseqs?: string[];
      closedDseqs?: string[];
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
    deploymentReaderService.findListedByOwnerAndDseq.mockImplementation(async (owner, dseq) => {
      const info = createDeploymentInfoSeed({ owner, dseq });

      return { deployment: info, leases: [createLeaseApiResponse({ owner, dseq }).lease] };
    });

    const reachableRows = input.reachable ?? [];
    const scopedSettingRepository = mock<DeploymentSettingRepository>();
    scopedSettingRepository.findReachable.mockResolvedValue(reachableRows);
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

    const service = new DeploymentListService(
      deploymentReaderService,
      deploymentSettingRepository,
      deploymentRepository,
      leaseGpuService,
      authService,
      executionContextService
    );

    return {
      service,
      user,
      context,
      authService,
      walletPage,
      deploymentReaderService,
      deploymentSettingRepository,
      scopedSettingRepository,
      deploymentRepository,
      leaseGpuService
    };
  }
});
