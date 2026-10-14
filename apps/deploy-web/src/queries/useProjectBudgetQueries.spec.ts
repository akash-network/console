import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { ProjectBudget, ProjectSpendReport } from "@src/types/project-budget";
import {
  PROJECT_BUDGETS_QUERY_KEY,
  useCreateProjectBudgetMutation,
  useDeleteProjectBudgetMutation,
  useProjectBudgetQuery,
  useProjectSpendQuery,
  useUpdateProjectBudgetMutation
} from "./useProjectBudgetQueries";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProjectBudgetQuery.name, () => {
  it("reads the budget of the project", async () => {
    const { result, listProjectBudgets } = setup({ budgets: [budget("storefront")] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listProjectBudgets).toHaveBeenCalledWith({ projectId: "storefront" });
    expect(result.current.data?.id).toBe("budget-storefront");
  });

  it("is null when the project has no budget the caller can read", async () => {
    const { result } = setup({ budgets: [budget("marketing")] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listProjectBudgets } = setup({ budgets: [], enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProjectBudgets).not.toHaveBeenCalled();
  });

  it("shares its key prefix with the one budget changes refresh", () => {
    const { api } = setup({ budgets: [] });

    expect(api.v1.listProjectBudgets.getKey({ projectId: "storefront" }).slice(0, 2)).toEqual([...PROJECT_BUDGETS_QUERY_KEY]);
  });

  function setup(input: { budgets: ProjectBudget[]; enabled?: boolean }) {
    const listProjectBudgets = vi.fn(async (_params: unknown) => ({ data: input.budgets }));
    const api = createProxy({ v1: { listProjectBudgets } }) as unknown as ApiService;
    const hook = setupQuery(() => useProjectBudgetQuery("storefront", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { ...hook, listProjectBudgets, api };
  }
});

describe(useProjectSpendQuery.name, () => {
  it("reads the spend report over the range", async () => {
    const { result, listProjectSpend } = setup({});

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listProjectSpend).toHaveBeenCalledWith({ startDate: "2026-03-01", endDate: "2026-03-15" });
    expect(result.current.data?.projects.map(project => project.name)).toEqual(["storefront"]);
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listProjectSpend } = setup({ enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProjectSpend).not.toHaveBeenCalled();
  });

  function setup(input: { enabled?: boolean }) {
    const report: ProjectSpendReport = {
      startDate: "2026-03-01",
      endDate: "2026-03-15",
      isEstimated: false,
      projects: [
        { projectId: "storefront", name: "storefront", isDefault: false, isDeleted: false, committedUsd: 10, consumedUsd: 5, estimatedConsumedUsd: 0 }
      ],
      unassigned: null,
      total: null
    };
    const listProjectSpend = vi.fn(async (_params: unknown) => ({ data: report }));
    const api = createProxy({ v1: { listProjectSpend } }) as unknown as ApiService;
    const hook = setupQuery(
      () => useProjectSpendQuery({ startDate: "2026-03-01", endDate: "2026-03-15" }, input.enabled === undefined ? undefined : { enabled: input.enabled }),
      { services: { api: () => api } }
    );

    return { ...hook, listProjectSpend };
  }
});

describe("budget mutations", () => {
  it("creates a budget and refreshes the budgets", async () => {
    const { result, createProjectBudget, refreshedKeys } = setupMutation(() => useCreateProjectBudgetMutation());

    await act(() => result.current.mutateAsync({ data: { projectId: "storefront", monthlyAmountUsd: 500 } }));

    expect(createProjectBudget).toHaveBeenCalledWith({ data: { projectId: "storefront", monthlyAmountUsd: 500 } });
    expect(refreshedKeys()).toEqual([PROJECT_BUDGETS_QUERY_KEY]);
  });

  it("refreshes the budgets after a refused create too", async () => {
    const { result, createProjectBudget, refreshedKeys } = setupMutation(() => useCreateProjectBudgetMutation());
    createProjectBudget.mockRejectedValueOnce(new Error("conflict"));

    await act(() => result.current.mutateAsync({ data: { projectId: "storefront", monthlyAmountUsd: 500 } }).catch(() => undefined));

    expect(refreshedKeys()).toEqual([PROJECT_BUDGETS_QUERY_KEY]);
  });

  it("updates a budget and refreshes the budgets", async () => {
    const { result, updateProjectBudget, refreshedKeys } = setupMutation(() => useUpdateProjectBudgetMutation());

    await act(() => result.current.mutateAsync({ id: "budget-storefront", data: { stopTopUps: true } }));

    expect(updateProjectBudget).toHaveBeenCalledWith({ id: "budget-storefront", data: { stopTopUps: true } });
    expect(refreshedKeys()).toEqual([PROJECT_BUDGETS_QUERY_KEY]);
  });

  it("removes a budget and refreshes the budgets", async () => {
    const { result, deleteProjectBudget, refreshedKeys } = setupMutation(() => useDeleteProjectBudgetMutation());

    await act(() => result.current.mutateAsync({ id: "budget-storefront" }));

    expect(deleteProjectBudget).toHaveBeenCalledWith({ id: "budget-storefront" });
    expect(refreshedKeys()).toEqual([PROJECT_BUDGETS_QUERY_KEY]);
  });

  function setupMutation<T>(useMutation: () => T) {
    const createProjectBudget = vi.fn(async (_params: unknown) => ({ data: budget("storefront") }));
    const updateProjectBudget = vi.fn(async (_params: unknown) => ({ data: budget("storefront") }));
    const deleteProjectBudget = vi.fn(async (_params: unknown) => undefined);
    const api = createProxy({ v1: { createProjectBudget, updateProjectBudget, deleteProjectBudget } }) as unknown as ApiService;
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const hook = setupQuery(useMutation, { services: { api: () => api, queryClient: () => queryClient } });

    return {
      ...hook,
      createProjectBudget,
      updateProjectBudget,
      deleteProjectBudget,
      refreshedKeys: () => invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)
    };
  }
});

function budget(projectId: string): ProjectBudget {
  return {
    id: `budget-${projectId}`,
    projectId,
    monthlyAmountUsd: 500,
    alertThresholdPercent: 80,
    stopTopUps: false,
    currentPeriod: { startDate: "2026-03-01", endDate: "2026-03-31", committedUsd: 120 },
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z"
  };
}
