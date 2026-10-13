import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { organizationRules } from "@src/auth/services/ability/ability-rules";
import type { AuthService } from "@src/auth/services/auth.service";
import type { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import type { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import type { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectOutput, ProjectRepository } from "@src/organization/repositories/project/project.repository";
import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";
import { ProjectSpendService } from "./project-spend.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const RANGE = { startDate: "2026-10-01", endDate: "2026-10-31" };
const RANGE_START = new Date("2026-10-01T00:00:00.000Z");
const RANGE_END = new Date("2026-11-01T00:00:00.000Z");

describe(ProjectSpendService.name, () => {
  describe("report", () => {
    it("gives an owner every project with its committed and consumed spend, the unassigned remainder and the total", async () => {
      const { service, projects, deploymentDepositRepository, deploymentSpendRepository, deploymentSettingRepository } = setup({ role: "owner" });
      const [defaultProject, staging] = projects;
      deploymentDepositRepository.sumCommittedByProject.mockResolvedValue([
        { projectId: defaultProject.id, amountCents: 1000 },
        { projectId: null, amountCents: 300 }
      ]);
      deploymentSpendRepository.findDepositedByDeployment.mockResolvedValue([{ owner: "a", dseq: "2", depositedMicroUsd: "5004999" }]);
      deploymentSpendRepository.findConsumedByDeployment.mockResolvedValue([
        { owner: "a", dseq: "1", settledMicroUsd: "2000000", accruedMicroUsd: "15000" },
        { owner: "a", dseq: "2", settledMicroUsd: "1000000", accruedMicroUsd: "0" },
        { owner: "a", dseq: "3", settledMicroUsd: "40000", accruedMicroUsd: "0" }
      ]);
      deploymentSettingRepository.findProjectIdsInOrganizationByDseqs.mockResolvedValue(
        new Map([
          ["1", defaultProject.id],
          ["2", staging.id]
        ])
      );

      const report = await service.report(RANGE);

      expect(report).toEqual({
        ...RANGE,
        projects: [
          { project: defaultProject, committedCents: 1000, consumedCents: 202, estimatedConsumedCents: 2 },
          { project: staging, committedCents: 500, consumedCents: 100, estimatedConsumedCents: 0 }
        ],
        unassigned: { committedCents: 300, consumedCents: 4, estimatedConsumedCents: 0 },
        total: { committedCents: 1800, consumedCents: 306, estimatedConsumedCents: 2 }
      });
      expect(deploymentSettingRepository.findProjectIdsInOrganizationByDseqs).toHaveBeenCalledWith(expect.any(String), ["2", "1", "2", "3"]);
    });

    it("lists the default project first, then live projects oldest first, and a deleted project only when it has spend", async () => {
      const organizationId = faker.string.uuid();
      const older = createProject({ organizationId, createdAt: new Date("2026-01-01") });
      const newer = createProject({ organizationId, createdAt: new Date("2026-02-01") });
      const defaultProject = createProject({ organizationId, isDefault: true, createdAt: new Date("2026-03-01") });
      const deletedWithSpend = createProject({ organizationId, deletedAt: new Date(), createdAt: new Date("2025-01-01") });
      const deletedWithout = createProject({ organizationId, deletedAt: new Date() });
      const { service, deploymentDepositRepository } = setup({ role: "admin", organizationId, projects: [newer, deletedWithSpend, older, deletedWithout, defaultProject] });
      deploymentDepositRepository.sumCommittedByProject.mockResolvedValue([{ projectId: deletedWithSpend.id, amountCents: 50 }]);

      const report = await service.report(RANGE);

      expect(report.projects.map(({ project }) => project.id)).toEqual([defaultProject.id, older.id, newer.id, deletedWithSpend.id]);
    });

    it("orders projects created at the same moment by id", async () => {
      const organizationId = faker.string.uuid();
      const createdAt = new Date("2026-01-01");
      const [first, second] = [createProject({ organizationId, createdAt }), createProject({ organizationId, createdAt })].sort((a, b) => a.id.localeCompare(b.id));
      const { service } = setup({ role: "owner", organizationId, projects: [second, first] });

      const report = await service.report(RANGE);

      expect(report.projects.map(({ project }) => project.id)).toEqual([first.id, second.id]);
    });

    it.each<OrganizationRole>(["member", "viewer"])("gives a %s only the projects it was granted, without the organization's figures", async role => {
      const { service, projects, deploymentDepositRepository } = setup({ role, grantedProjectIndexes: [1] });
      deploymentDepositRepository.sumCommittedByProject.mockResolvedValue([
        { projectId: projects[0].id, amountCents: 1000 },
        { projectId: projects[1].id, amountCents: 700 },
        { projectId: null, amountCents: 300 }
      ]);

      const report = await service.report(RANGE);

      expect(report.projects).toEqual([{ project: projects[1], committedCents: 700, consumedCents: 0, estimatedConsumedCents: 0 }]);
      expect(report.unassigned).toBeNull();
      expect(report.total).toBeNull();
    });

    it("gives the billing role every project and the organization's figures", async () => {
      const { service, projects } = setup({ role: "billing" });

      const report = await service.report(RANGE);

      expect(report.projects.map(({ project }) => project.id)).toEqual(projects.map(({ id }) => id));
      expect(report.unassigned).toEqual({ committedCents: 0, consumedCents: 0, estimatedConsumedCents: 0 });
      expect(report.total).toEqual({ committedCents: 0, consumedCents: 0, estimatedConsumedCents: 0 });
    });

    it("keeps an owner narrowed to one project to that project, without the organization's figures", async () => {
      const organizationId = faker.string.uuid();
      const projects = [createProject({ organizationId, isDefault: true }), createProject({ organizationId })];
      const { service } = setup({ role: "owner", organizationId, projects, projectScope: createProjectsScope([projects[1].id]) });

      const report = await service.report(RANGE);

      expect(report.projects.map(({ project }) => project.id)).toEqual([projects[1].id]);
      expect(report.total).toBeNull();
    });

    it("reads no spend for a caller who can see no project and not the organization", async () => {
      const { service, deploymentSpendRepository, deploymentDepositRepository, userWalletRepository } = setup({ role: "member", grantedProjectIndexes: [] });

      const report = await service.report(RANGE);

      expect(report).toEqual({ ...RANGE, projects: [], unassigned: null, total: null });
      expect(userWalletRepository.findOneBy).not.toHaveBeenCalled();
      expect(deploymentDepositRepository.sumCommittedByProject).not.toHaveBeenCalled();
      expect(deploymentSpendRepository.findConsumedByDeployment).not.toHaveBeenCalled();
    });

    it("reads the ledger over the whole range and the chain index only up to the ledger's first record", async () => {
      const firstRecordedAt = new Date("2026-10-12T08:00:00.000Z");
      const { service, organizationId, wallet, deploymentDepositRepository, deploymentSpendRepository } = setup({ role: "owner" });
      deploymentDepositRepository.findFirstRecordedAt.mockResolvedValue(firstRecordedAt);

      await service.report(RANGE);

      expect(deploymentDepositRepository.sumCommittedByProject).toHaveBeenCalledWith(organizationId, { from: RANGE_START, to: RANGE_END });
      expect(deploymentSpendRepository.findDepositedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address], from: RANGE_START, to: firstRecordedAt });
      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address], ...RANGE });
    });

    it.each([
      { case: "has no record yet", firstRecordedAt: undefined },
      { case: "starts after the range", firstRecordedAt: new Date("2026-12-01T00:00:00.000Z") },
      { case: "starts exactly at the range's end", firstRecordedAt: RANGE_END }
    ])("reads the chain index over the whole range when the ledger $case", async ({ firstRecordedAt }) => {
      const { service, wallet, deploymentDepositRepository, deploymentSpendRepository } = setup({ role: "owner" });
      deploymentDepositRepository.findFirstRecordedAt.mockResolvedValue(firstRecordedAt);

      await service.report(RANGE);

      expect(deploymentSpendRepository.findDepositedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address], from: RANGE_START, to: RANGE_END });
    });

    it("also reads the earlier address of a wallet made before the derivation migration", async () => {
      const wallet = createUserWallet({ createdAt: new Date("2025-06-01"), organizationId: faker.string.uuid() });
      const earlierAddress = createAkashAddress();
      const { service, deploymentSpendRepository, txManagerService } = setup({ role: "owner", wallet });
      txManagerService.getDerivedWalletAddress.mockResolvedValue(earlierAddress);

      await service.report(RANGE);

      expect(txManagerService.getDerivedWalletAddress).toHaveBeenCalledWith(wallet.id, { walletVersion: "v1" });
      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address, earlierAddress], ...RANGE });
    });

    it("reads one address when the earlier derivation gives the same one", async () => {
      const wallet = createUserWallet({ createdAt: new Date("2025-06-01"), organizationId: faker.string.uuid() });
      const { service, deploymentSpendRepository, txManagerService } = setup({ role: "owner", wallet });
      txManagerService.getDerivedWalletAddress.mockResolvedValue(wallet.address!);

      await service.report(RANGE);

      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address], ...RANGE });
    });

    it("falls back to the current address when the earlier one cannot be derived", async () => {
      const wallet = createUserWallet({ createdAt: new Date("2025-06-01"), organizationId: faker.string.uuid() });
      const error = new Error("derivation failed");
      const { service, deploymentSpendRepository, txManagerService, logger } = setup({ role: "owner", wallet });
      txManagerService.getDerivedWalletAddress.mockRejectedValue(error);

      await service.report(RANGE);

      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({ owners: [wallet.address], ...RANGE });
      expect(logger.error).toHaveBeenCalledWith({ event: "PROJECT_SPEND_EARLIER_ADDRESS_UNAVAILABLE", walletId: wallet.id, error });
    });

    it("reads the chain index for no address when the organization has no wallet address", async () => {
      const { service, deploymentSpendRepository, userWalletRepository, txManagerService } = setup({ role: "owner" });
      userWalletRepository.findOneBy.mockResolvedValue(createUserWallet({ address: null }));

      await service.report(RANGE);

      expect(txManagerService.getDerivedWalletAddress).not.toHaveBeenCalled();
      expect(deploymentSpendRepository.findConsumedByDeployment).toHaveBeenCalledWith({ owners: [], ...RANGE });
    });

    it("looks the wallet up in the active organization", async () => {
      const { service, organizationId, userWalletRepository } = setup({ role: "owner" });

      await service.report(RANGE);

      expect(userWalletRepository.findOneBy).toHaveBeenCalledWith({ organizationId });
    });

    it("refuses a request that runs in no organization", async () => {
      const { service } = setup({ role: "owner", withoutContext: true });

      await expect(service.report(RANGE)).rejects.toMatchObject({ status: 403 });
    });
  });

  function setup(input: {
    role: OrganizationRole;
    organizationId?: string;
    projects?: ProjectOutput[];
    grantedProjectIndexes?: number[];
    projectScope?: ProjectScope;
    wallet?: ReturnType<typeof createUserWallet>;
    withoutContext?: boolean;
  }) {
    const organizationId = input.organizationId ?? faker.string.uuid();
    const projects = input.projects ?? [
      createProject({ organizationId, isDefault: true, createdAt: new Date("2026-01-01") }),
      createProject({ organizationId, createdAt: new Date("2026-02-01") })
    ];
    const grantedProjectIds = (input.grantedProjectIndexes ?? [0]).map(index => projects[index].id);
    const defaultScopes: Record<OrganizationRole, ProjectScope> = {
      owner: { kind: "all" },
      admin: { kind: "all" },
      member: createProjectsScope(grantedProjectIds),
      viewer: createProjectsScope(grantedProjectIds),
      billing: createProjectsScope([])
    };
    const context: OrganizationContext = createOrganizationContext({ organizationId, role: input.role, projectScope: input.projectScope ?? defaultScopes[input.role] });
    const ability = createMongoAbility(organizationRules(createUser(), context));
    const wallet = input.wallet ?? createUserWallet({ organizationId, createdAt: new Date("2026-01-01") });

    const projectRepository = mock<ProjectRepository>({ find: vi.fn().mockResolvedValue(projects) });
    const userWalletRepository = mock<UserWalletRepository>({ findOneBy: vi.fn().mockResolvedValue(wallet) });
    const deploymentDepositRepository = mock<DeploymentDepositRepository>({
      findFirstRecordedAt: vi.fn().mockResolvedValue(undefined),
      sumCommittedByProject: vi.fn().mockResolvedValue([])
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({ findProjectIdsInOrganizationByDseqs: vi.fn().mockResolvedValue(new Map()) });
    const deploymentSpendRepository = mock<DeploymentSpendRepository>({
      findDepositedByDeployment: vi.fn().mockResolvedValue([]),
      findConsumedByDeployment: vi.fn().mockResolvedValue([])
    });
    const txManagerService = mock<TxManagerService>();
    const authService = mock<AuthService>();
    authService.ability = ability;
    const executionContextService = mock<ExecutionContextService>({
      get: vi.fn().mockReturnValue(input.withoutContext ? undefined : context) as ExecutionContextService["get"]
    });
    const logger = mock<ReturnType<CreateLogger>>();

    const service = new ProjectSpendService(
      projectRepository,
      userWalletRepository,
      deploymentDepositRepository,
      deploymentSettingRepository,
      deploymentSpendRepository,
      txManagerService,
      authService,
      executionContextService,
      () => logger
    );

    return {
      service,
      organizationId,
      projects,
      wallet,
      projectRepository,
      userWalletRepository,
      deploymentDepositRepository,
      deploymentSettingRepository,
      deploymentSpendRepository,
      txManagerService,
      logger
    };
  }
});
