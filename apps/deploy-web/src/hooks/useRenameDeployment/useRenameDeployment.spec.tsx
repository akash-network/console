import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useRenameDeployment";
import { useRenameDeployment } from "./useRenameDeployment";

import { renderHook } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

describe(useRenameDeployment.name, () => {
  it("settles a name backfill for the deployment before renaming it, then refreshes what shows the name", async () => {
    const { result, preempt, patchDeployment, queryClient } = setup({ owner: "akash1owner" });

    await result.current("42", "blog-prod");

    expect(preempt).toHaveBeenCalledWith("akash1owner", "42");
    expect(patchDeployment).toHaveBeenCalledWith({ dseq: "42", data: { name: "blog-prod" } });
    expect(preempt.mock.invocationCallOrder[0]).toBeLessThan(patchDeployment.mock.invocationCallOrder[0]);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "getDeployment", { dseq: "42" }] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listDeploymentNames"] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listDeployments"] });
  });

  it("renames without waiting on a backfill when no wallet is known yet", async () => {
    const { result, preempt, patchDeployment } = setup({ owner: null });

    await result.current("42", "blog-prod");

    expect(preempt).not.toHaveBeenCalled();
    expect(patchDeployment).toHaveBeenCalledWith({ dseq: "42", data: { name: "blog-prod" } });
  });

  it("lets a refused rename reach the caller without refreshing anything", async () => {
    const { result, patchDeployment, queryClient } = setup({ owner: "akash1owner" });
    patchDeployment.mockRejectedValue(new Error("Refused"));

    await expect(result.current("42", "blog-prod")).rejects.toThrow("Refused");
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  function setup(input: { owner: string | null }) {
    const patchDeployment = vi.fn(async (_input: unknown) => ({ data: {} }));
    const preempt = vi.fn(async () => {});
    const api = createProxy({
      v1: { patchDeployment, getDeployment: vi.fn(), listDeploymentNames: vi.fn(), listDeployments: vi.fn() }
    }) as unknown as Container["api"];
    const queryClient = new QueryClient();
    vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useRenameDeployment({
          useServices: () => Object.assign(mock<Container>(), { api, deploymentNameBackfill: mock<Container["deploymentNameBackfill"]>({ preempt }) }),
          useQueryClient: () => queryClient,
          useAtomValue: (() => input.owner) as unknown as typeof DEPENDENCIES.useAtomValue
        }),
      { wrapper: ({ children }) => <TestContainerProvider>{children}</TestContainerProvider> }
    );

    return { result, patchDeployment, preempt, queryClient };
  }
});
