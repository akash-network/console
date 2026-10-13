import { createMongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { PostgresError } from "postgres";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { organizationRules } from "@src/auth/services/ability/ability-rules";
import type { AuthService } from "@src/auth/services/auth.service";
import type { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { budgetPeriodOf } from "@src/organization/lib/budget-period/budget-period";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectRepository } from "@src/organization/repositories/project/project.repository";
import {
  PROJECT_BUDGET_UNIQUE_CONSTRAINT,
  type ProjectBudgetOutput,
  type ProjectBudgetRepository
} from "@src/organization/repositories/project-budget/project-budget.repository";
import type { ProjectScope } from "@src/organization/types/organization-context";
import { ProjectBudgetService } from "./project-budget.service";

import { createProject } from "@test/seeders/organization.seeder";
import { createOrganizationContext, createProjectsScope } from "@test/seeders/organization-context.seeder";
import { createUser } from "@test/seeders/user.seeder";

describe(ProjectBudgetService.name, () => {
  describe("list", () => {
    it("lists the readable budgets of the active organization with this month's committed spend", async () => {
      const { service, organizationId, projectBudgetRepository, deploymentDepositRepository } = setup({ role: "owner" });
      const budget = createBudget({ organizationId });
      projectBudgetRepository.find.mockResolvedValue([budget]);
      deploymentDepositRepository.sumCommittedInProject.mockResolvedValue(1234);

      const budgets = await service.list({});

      const period = budgetPeriodOf(new Date());
      expect(projectBudgetRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "read");
      expect(projectBudgetRepository.find).toHaveBeenCalledWith({ organizationId });
      expect(deploymentDepositRepository.sumCommittedInProject).toHaveBeenCalledWith(organizationId, budget.projectId, period);
      expect(budgets).toEqual([{ ...budget, period, periodCommittedCents: 1234 }]);
    });

    it("lists nothing to a caller no rule lets read a budget", async () => {
      const { service, projectBudgetRepository } = setup({ role: "viewer", projectScope: createProjectsScope(["project-1"]) });

      expect(await service.list({})).toEqual([]);
      expect(projectBudgetRepository.find).not.toHaveBeenCalled();
    });

    it("narrows the list to one project when asked", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({ role: "owner" });

      await service.list({ projectId: "project-1" });

      expect(projectBudgetRepository.find).toHaveBeenCalledWith({ organizationId, projectId: "project-1" });
    });
  });

  describe("create", () => {
    it("sets a budget on a project the caller reaches, recording who set it", async () => {
      const { service, organizationId, user, projectRepository, projectBudgetRepository } = setup({ role: "admin" });
      const project = createProject({ organizationId });
      projectRepository.findOneBy.mockResolvedValue(project);
      projectBudgetRepository.create.mockImplementation(async input => createBudget({ ...input, alertThresholdPercent: 80, stopTopUps: false }));

      const budget = await service.create({ projectId: project.id, monthlyAmountCents: 5000 });

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: project.id, deletedAt: null });
      expect(projectBudgetRepository.create).toHaveBeenCalledWith({ projectId: project.id, monthlyAmountCents: 5000, organizationId, createdByUserId: user.id });
      expect(budget).toMatchObject({ projectId: project.id, monthlyAmountCents: 5000, periodCommittedCents: 0 });
    });

    it("answers 404 for a project out of the caller's reach", async () => {
      const { service, projectBudgetRepository } = setup({ role: "owner" });

      await expect(service.create({ projectId: "missing", monthlyAmountCents: 5000 })).rejects.toMatchObject({ status: 404, message: "Project not found" });
      expect(projectBudgetRepository.create).not.toHaveBeenCalled();
    });

    it.each<{ role: OrganizationRole; projectScope?: ProjectScope }>([
      { role: "billing" },
      { role: "member", projectScope: createProjectsScope(["project-1"], { adminProjectIds: ["project-1"] }) }
    ])("refuses the $role role", async ({ role, projectScope }) => {
      const { service, organizationId, projectRepository, projectBudgetRepository } = setup({ role, projectScope });
      projectRepository.findOneBy.mockResolvedValue(createProject({ id: "project-1", organizationId }));

      await expect(service.create({ projectId: "project-1", monthlyAmountCents: 5000 })).rejects.toMatchObject({ status: 403 });
      expect(projectBudgetRepository.create).not.toHaveBeenCalled();
    });

    it("answers 409 when the project already has a budget", async () => {
      const { service, organizationId, projectRepository, projectBudgetRepository } = setup({ role: "owner" });
      projectRepository.findOneBy.mockResolvedValue(createProject({ organizationId }));
      projectBudgetRepository.create.mockRejectedValue(uniqueViolation(PROJECT_BUDGET_UNIQUE_CONSTRAINT));

      await expect(service.create({ projectId: "project-1", monthlyAmountCents: 5000 })).rejects.toMatchObject({
        status: 409,
        errorCode: "project_budget_exists"
      });
    });

    it("lets another failure through", async () => {
      const { service, organizationId, projectRepository, projectBudgetRepository } = setup({ role: "owner" });
      const failure = uniqueViolation("another_constraint");
      projectRepository.findOneBy.mockResolvedValue(createProject({ organizationId }));
      projectBudgetRepository.create.mockRejectedValue(failure);

      await expect(service.create({ projectId: "project-1", monthlyAmountCents: 5000 })).rejects.toBe(failure);
    });

    it("refuses a request that runs in no organization", async () => {
      const { service } = setup({ role: "owner", withoutContext: true });

      await expect(service.create({ projectId: "project-1", monthlyAmountCents: 5000 })).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("update", () => {
    it("changes the budget's settings", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({ role: "owner" });
      const budget = createBudget({ organizationId });
      projectBudgetRepository.findOneBy.mockResolvedValue(budget);
      projectBudgetRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue({ ...budget, stopTopUps: true }));

      const updated = await service.update(budget.id, { stopTopUps: true });

      expect(projectBudgetRepository.updateBy).toHaveBeenCalledWith({ id: budget.id }, { stopTopUps: true }, { returning: true });
      expect(updated).toMatchObject({ id: budget.id, stopTopUps: true });
    });

    it("returns the budget as read when the update wrote nothing", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({ role: "owner" });
      const budget = createBudget({ organizationId });
      projectBudgetRepository.findOneBy.mockResolvedValue(budget);
      projectBudgetRepository.updateBy.mockImplementation(vi.fn().mockResolvedValue(undefined));

      expect(await service.update(budget.id, {})).toMatchObject({ id: budget.id });
    });

    it("answers 404 for a budget the caller cannot read", async () => {
      const { service } = setup({ role: "owner" });

      await expect(service.update("missing", { stopTopUps: true })).rejects.toMatchObject({ status: 404, message: "Project budget not found" });
    });

    it("lets a project admin read but not change the budget of its project", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({
        role: "member",
        projectScope: createProjectsScope(["project-1"], { adminProjectIds: ["project-1"] })
      });
      projectBudgetRepository.findOneBy.mockResolvedValue(createBudget({ organizationId, projectId: "project-1" }));

      await expect(service.update("budget-1", { stopTopUps: true })).rejects.toMatchObject({ status: 403 });
      expect(projectBudgetRepository.updateBy).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("removes the budget", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({ role: "admin" });
      const budget = createBudget({ organizationId });
      projectBudgetRepository.findOneBy.mockResolvedValue(budget);

      await service.delete(budget.id);

      expect(projectBudgetRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "delete");
      expect(projectBudgetRepository.deleteById).toHaveBeenCalledWith(budget.id);
    });

    it("refuses the billing role", async () => {
      const { service, organizationId, projectBudgetRepository } = setup({ role: "billing" });
      projectBudgetRepository.findOneBy.mockResolvedValue(createBudget({ organizationId }));

      await expect(service.delete("budget-1")).rejects.toMatchObject({ status: 403, message: "Only owners and admins can change project budgets" });
      expect(projectBudgetRepository.deleteById).not.toHaveBeenCalled();
    });
  });

  function createBudget(overrides: Partial<ProjectBudgetOutput> = {}): ProjectBudgetOutput {
    return {
      id: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      projectId: faker.string.uuid(),
      monthlyAmountCents: 10_000,
      alertThresholdPercent: 80,
      stopTopUps: false,
      alertedForPeriod: null,
      createdByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  function uniqueViolation(constraint: string) {
    const driverError = Object.assign(Object.create(PostgresError.prototype), { name: "PostgresError", code: "23505", constraint_name: constraint });

    return new Error("duplicate key value", { cause: driverError });
  }

  function setup(input: { role: OrganizationRole; projectScope?: ProjectScope; withoutContext?: boolean }) {
    const user = createUser();
    const context = createOrganizationContext({ role: input.role, projectScope: input.projectScope ?? createProjectsScope([]) });
    const scopedContext = input.role === "owner" || input.role === "admin" ? { ...context, projectScope: input.projectScope ?? { kind: "all" as const } } : context;
    const projectBudgetRepository = mock<ProjectBudgetRepository>({ find: vi.fn().mockResolvedValue([]), findOneBy: vi.fn().mockResolvedValue(undefined) });
    projectBudgetRepository.accessibleBy.mockReturnValue(projectBudgetRepository);
    const projectRepository = mock<ProjectRepository>({ findOneBy: vi.fn().mockResolvedValue(undefined) });
    projectRepository.accessibleBy.mockReturnValue(projectRepository);
    const deploymentDepositRepository = mock<DeploymentDepositRepository>({ sumCommittedInProject: vi.fn().mockResolvedValue(0) });
    const authService = mock<AuthService>({ currentUser: user });
    authService.ability = createMongoAbility(organizationRules(user, scopedContext));
    const executionContextService = mock<ExecutionContextService>({
      get: vi.fn().mockReturnValue(input.withoutContext ? undefined : scopedContext) as ExecutionContextService["get"]
    });

    const service = new ProjectBudgetService(projectBudgetRepository, projectRepository, deploymentDepositRepository, authService, executionContextService);

    return { service, user, organizationId: scopedContext.organizationId, projectBudgetRepository, projectRepository, deploymentDepositRepository };
  }
});
