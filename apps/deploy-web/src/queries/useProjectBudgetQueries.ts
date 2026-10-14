import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { ProjectBudget, ProjectSpendReport, SpendRange } from "@src/types/project-budget";

/** Equals `api.v1.listProjectBudgets.getKey()`, the prefix every budget read sits under. */
export const PROJECT_BUDGETS_QUERY_KEY = ["v1", "listProjectBudgets"] as const;

interface QueryOptions {
  enabled?: boolean;
}

/** The project's monthly budget, or null when it has none or the caller may not read it. */
export function useProjectBudgetQuery(projectId: string, { enabled = true }: QueryOptions = {}) {
  const { api } = useServices();

  return api.v1.listProjectBudgets.useQuery(
    { projectId },
    { enabled, select: (response): ProjectBudget | null => response.data.find(budget => budget.projectId === projectId) ?? null }
  );
}

/** Spend of the projects the caller can see over the range; the organization's total and unassigned share come only to roles that see everything. */
export function useProjectSpendQuery(range: SpendRange, { enabled = true }: QueryOptions = {}) {
  const { api } = useServices();

  return api.v1.listProjectSpend.useQuery(range, { enabled, select: (response): ProjectSpendReport => response.data });
}

export function useCreateProjectBudgetMutation() {
  const { api } = useServices();
  const refreshBudgets = useRefreshBudgets();

  return api.v1.createProjectBudget.useMutation({ onSettled: refreshBudgets });
}

export function useUpdateProjectBudgetMutation() {
  const { api } = useServices();
  const refreshBudgets = useRefreshBudgets();

  return api.v1.updateProjectBudget.useMutation({ onSettled: refreshBudgets });
}

export function useDeleteProjectBudgetMutation() {
  const { api } = useServices();
  const refreshBudgets = useRefreshBudgets();

  return api.v1.deleteProjectBudget.useMutation({ onSettled: refreshBudgets });
}

function useRefreshBudgets() {
  const queryClient = useQueryClient();

  return () => queryClient.invalidateQueries({ queryKey: PROJECT_BUDGETS_QUERY_KEY });
}
