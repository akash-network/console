import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentDepositRepository } from "@src/billing/repositories/deployment-deposit/deployment-deposit.repository";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import { budgetPeriodOf } from "@src/organization/lib/budget-period/budget-period";
import type { OrganizationMemberOutput, OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectBudgetOutput, ProjectBudgetRepository } from "@src/organization/repositories/project-budget/project-budget.repository";
import { ProjectBudgetAlert } from "@src/organization/services/project-budget-alert/project-budget-alert.handler";
import {
  type BudgetedDeposit,
  isProjectBudgetExceeded,
  PROJECT_BUDGET_EXCEEDED_ERROR_CODE,
  ProjectBudgetEnforcementService,
  ProjectBudgetExceededError
} from "./project-budget-enforcement.service";

const ORGANIZATION_ID = "organization-1";

describe(ProjectBudgetEnforcementService.name, () => {
  describe("enforce", () => {
    it("records deposits into a project without a budget", async () => {
      const { service, jobQueueService } = setup({ budgets: [] });
      const record = vi.fn().mockResolvedValue("recorded");

      expect(await service.enforce([createDeposit({ projectId: "project-a" })], record)).toBe("recorded");
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("locks each budget, sorted, and judges it against the deposits recorded for its project this month", async () => {
      const { service, projectBudgetRepository, deploymentDepositRepository } = setup({
        budgets: [createBudget({ projectId: "project-a" }), createBudget({ projectId: "project-b" })]
      });

      await service.enforce([createDeposit({ projectId: "project-b" }), createDeposit({ projectId: "project-a" })], vi.fn());

      expect(projectBudgetRepository.findOneByAndLock.mock.calls).toEqual([
        [{ organizationId: ORGANIZATION_ID, projectId: "project-a" }, { strength: "no key update" }],
        [{ organizationId: ORGANIZATION_ID, projectId: "project-b" }, { strength: "no key update" }]
      ]);
      expect(deploymentDepositRepository.sumCommittedInProject).toHaveBeenCalledWith(ORGANIZATION_ID, "project-a", budgetPeriodOf(new Date()));
    });

    it("runs the check and the record in one transaction", async () => {
      const { service, txService, projectBudgetRepository } = setup({ budgets: [createBudget()] });
      const record = vi.fn();

      await service.enforce([createDeposit()], record);

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(projectBudgetRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeGreaterThan(txService.transaction.mock.invocationCallOrder[0]);
      expect(record.mock.invocationCallOrder[0]).toBeGreaterThan(projectBudgetRepository.findOneByAndLock.mock.invocationCallOrder[0]);
    });

    it("refuses a create that would take the project past its budget and records nothing", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000 })], committedCents: 900 });
      const record = vi.fn();

      const error = await service.enforce([createDeposit({ kind: "deployment_create", amountCents: 101, dseq: "77" })], record).catch(error => error);

      expect(isProjectBudgetExceeded(error)).toBe(true);
      expect(error).toMatchObject({ status: 403, errorCode: PROJECT_BUDGET_EXCEEDED_ERROR_CODE, dseqs: ["77"], data: { projectIds: ["project-a"] } });
      expect(record).not.toHaveBeenCalled();
    });

    it("allows a create that brings the project exactly to its budget", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000 })], committedCents: 900 });
      const record = vi.fn().mockResolvedValue("recorded");

      expect(await service.enforce([createDeposit({ kind: "deployment_create", amountCents: 100 })], record)).toBe("recorded");
    });

    it("lets a top-up past the budget through while the budget leaves running deployments alone", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, stopTopUps: false })], committedCents: 990 });
      const record = vi.fn().mockResolvedValue("recorded");

      expect(await service.enforce([createDeposit({ kind: "top_up", amountCents: 500 })], record)).toBe("recorded");
    });

    it("refuses a top-up past the budget once the budget stops top-ups", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, stopTopUps: true })], committedCents: 990 });

      await expect(service.enforce([createDeposit({ kind: "top_up", amountCents: 11 })], vi.fn())).rejects.toBeInstanceOf(ProjectBudgetExceededError);
    });

    it("lets a top-up within the budget through even when the budget stops top-ups", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, stopTopUps: true })], committedCents: 990 });
      const record = vi.fn().mockResolvedValue("recorded");

      expect(await service.enforce([createDeposit({ kind: "top_up", amountCents: 10 })], record)).toBe("recorded");
    });

    it("sums every deposit of a project in the transaction before judging it", async () => {
      const { service } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000 })], committedCents: 400 });
      const record = vi.fn();

      await expect(
        service.enforce(
          [createDeposit({ kind: "deployment_create", amountCents: 300, dseq: "1" }), createDeposit({ kind: "top_up", amountCents: 301, dseq: "2" })],
          record
        )
      ).rejects.toMatchObject({ dseqs: ["1", "2"] });
      expect(record).not.toHaveBeenCalled();
    });

    it("refuses a transaction whose deposits fit one budget but not the other", async () => {
      const { service } = setup({
        budgets: [createBudget({ projectId: "project-a", monthlyAmountCents: 10_000 }), createBudget({ projectId: "project-b", monthlyAmountCents: 100 })],
        committedCents: 50
      });

      await expect(
        service.enforce([createDeposit({ projectId: "project-a", dseq: "1" }), createDeposit({ projectId: "project-b", dseq: "2" })], vi.fn())
      ).rejects.toMatchObject({ dseqs: ["2"], data: { projectIds: ["project-b"] } });
    });

    it("names every project that refused in one refusal", async () => {
      const { service } = setup({
        budgets: [createBudget({ projectId: "project-a", monthlyAmountCents: 100 }), createBudget({ projectId: "project-b", monthlyAmountCents: 100 })],
        committedCents: 100
      });

      await expect(
        service.enforce([createDeposit({ projectId: "project-a", dseq: "1" }), createDeposit({ projectId: "project-b", dseq: "2" })], vi.fn())
      ).rejects.toMatchObject({ dseqs: ["1", "2"], data: { projectIds: ["project-a", "project-b"] } });
    });

    it("returns nothing when only asked to judge", async () => {
      const { service } = setup({ budgets: [createBudget()] });

      expect(await service.enforce([createDeposit()])).toBeUndefined();
    });

    it("alerts every owner and admin once the deposits reach the threshold, marking the month", async () => {
      const budget = createBudget({ monthlyAmountCents: 1000, alertThresholdPercent: 80 });
      const { service, jobQueueService, projectBudgetRepository, organizationMemberRepository } = setup({ budgets: [budget], committedCents: 700 });
      const period = budgetPeriodOf(new Date());

      await service.enforce([createDeposit({ amountCents: 100 })], vi.fn());

      expect(organizationMemberRepository.find.mock.calls).toEqual([[{ organizationId: ORGANIZATION_ID, role: "owner" }], [{ organizationId: ORGANIZATION_ID, role: "admin" }]]);
      expect(projectBudgetRepository.updateById).toHaveBeenCalledWith(budget.id, { alertedForPeriod: period.key });
      expect(jobQueueService.enqueue.mock.calls.map(([job]) => job)).toEqual(
        ["owner-1", "admin-1"].map(
          userId =>
            new ProjectBudgetAlert({ userId, organizationId: ORGANIZATION_ID, projectId: budget.projectId, period: period.key, committedCents: 800, refusedCents: 0 })
        )
      );
    });

    it("leaves the threshold alert to the recording that follows when only asked to judge", async () => {
      const { service, jobQueueService, projectBudgetRepository } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, alertThresholdPercent: 80 })], committedCents: 700 });

      await service.enforce([createDeposit({ amountCents: 200 })]);

      expect(projectBudgetRepository.updateById).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("alerts on a refusal even when only asked to judge", async () => {
      const budget = createBudget({ monthlyAmountCents: 1000 });
      const { service, jobQueueService, projectBudgetRepository } = setup({ budgets: [budget], committedCents: 900 });

      await expect(service.enforce([createDeposit({ kind: "deployment_create", amountCents: 200 })])).rejects.toBeInstanceOf(ProjectBudgetExceededError);

      expect(projectBudgetRepository.updateById).toHaveBeenCalledWith(budget.id, { alertedForPeriod: budgetPeriodOf(new Date()).key });
      expect(jobQueueService.enqueue).toHaveBeenCalled();
    });

    it("stays quiet below the threshold", async () => {
      const { service, jobQueueService, projectBudgetRepository } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, alertThresholdPercent: 80 })], committedCents: 700 });

      await service.enforce([createDeposit({ amountCents: 99 })], vi.fn());

      expect(projectBudgetRepository.updateById).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("alerts with the refused deposit when a single deposit jumps past the budget, before refusing it", async () => {
      const budget = createBudget({ monthlyAmountCents: 1000, alertThresholdPercent: 80 });
      const { service, jobQueueService, projectBudgetRepository } = setup({ budgets: [budget], committedCents: 100 });

      await expect(service.enforce([createDeposit({ kind: "deployment_create", amountCents: 5000 })], vi.fn())).rejects.toBeInstanceOf(ProjectBudgetExceededError);

      expect(projectBudgetRepository.updateById).toHaveBeenCalledWith(budget.id, { alertedForPeriod: budgetPeriodOf(new Date()).key });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ committedCents: 100, refusedCents: 5000 }) }));
    });

    it("alerts once per month", async () => {
      const { service, jobQueueService, projectBudgetRepository } = setup({
        budgets: [createBudget({ monthlyAmountCents: 1000, alertedForPeriod: budgetPeriodOf(new Date()).key })],
        committedCents: 1000
      });

      await expect(service.enforce([createDeposit({ kind: "deployment_create", amountCents: 1 })], vi.fn())).rejects.toBeInstanceOf(ProjectBudgetExceededError);

      expect(projectBudgetRepository.updateById).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("alerts again in a new month", async () => {
      const { service, jobQueueService } = setup({ budgets: [createBudget({ monthlyAmountCents: 1000, alertedForPeriod: "2000-01-01" })], committedCents: 900 });

      await service.enforce([createDeposit({ amountCents: 1 })], vi.fn());

      expect(jobQueueService.enqueue).toHaveBeenCalled();
    });

    it("logs the refusal", async () => {
      const { service, logger } = setup({ budgets: [createBudget({ monthlyAmountCents: 1 })], committedCents: 1 });

      await service.enforce([createDeposit({ dseq: "5" })], vi.fn()).catch(() => undefined);

      expect(logger.info).toHaveBeenCalledWith({ event: "PROJECT_BUDGET_DEPOSIT_REFUSED", projectIds: ["project-a"], dseqs: ["5"] });
    });
  });

  function createDeposit(overrides: Partial<BudgetedDeposit> = {}): BudgetedDeposit {
    return { organizationId: ORGANIZATION_ID, projectId: "project-a", dseq: faker.string.numeric(8), kind: "deployment_create", amountCents: 100, ...overrides };
  }

  function createBudget(overrides: Partial<ProjectBudgetOutput> = {}): ProjectBudgetOutput {
    return {
      id: faker.string.uuid(),
      organizationId: ORGANIZATION_ID,
      projectId: "project-a",
      monthlyAmountCents: 100_000,
      alertThresholdPercent: 80,
      stopTopUps: false,
      alertedForPeriod: null,
      createdByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  function setup(input: { budgets: ProjectBudgetOutput[]; committedCents?: number }) {
    const projectBudgetRepository = mock<ProjectBudgetRepository>({
      findOneByAndLock: vi.fn(async query => input.budgets.find(({ projectId }) => projectId === query?.projectId))
    });
    const deploymentDepositRepository = mock<DeploymentDepositRepository>({ sumCommittedInProject: vi.fn().mockResolvedValue(input.committedCents ?? 0) });
    const organizationMemberRepository = mock<OrganizationMemberRepository>({
      find: vi.fn(async query => [mock<OrganizationMemberOutput>({ userId: `${query?.role}-1` })])
    });
    const jobQueueService = mock<JobQueueService>();
    const txService = mock<TxService>({ transaction: vi.fn(async cb => await cb()) as TxService["transaction"] });
    const logger = mock<ReturnType<CreateLogger>>();

    const service = new ProjectBudgetEnforcementService(projectBudgetRepository, deploymentDepositRepository, organizationMemberRepository, jobQueueService, txService, () => logger);

    return { service, projectBudgetRepository, deploymentDepositRepository, organizationMemberRepository, jobQueueService, txService, logger };
  }
});
