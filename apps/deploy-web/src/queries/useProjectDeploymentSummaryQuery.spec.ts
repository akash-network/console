import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { PROJECT_PREVIEW_SIZE, useProjectDeploymentSummaryQuery } from "./useProjectDeploymentSummaryQuery";

import { waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProjectDeploymentSummaryQuery.name, () => {
  it("asks for the project's newest open deployments, no more than a folder files", async () => {
    const { result, listDeployments } = setup({ items: [], total: 0 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listDeployments).toHaveBeenCalledWith({ projectId: "p1", state: "active", reverse: "true", limit: PROJECT_PREVIEW_SIZE });
  });

  it("counts every open deployment and previews the ones read, with their status", async () => {
    const { result } = setup({ items: [item("300", "web", []), item("200", null, [{ state: "active" }])], total: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      activeCount: 7,
      preview: [
        { dseq: "300", name: "web", status: "spinning" },
        { dseq: "200", name: "Deployment #200", status: "running" }
      ]
    });
  });

  it("counts the deployments read when the api cannot count them and none remain", async () => {
    const { result } = setup({ items: [item("300", "web", [])], total: null });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.activeCount).toBe(1);
  });

  it("leaves the count unknown when the api cannot count them and more remain", async () => {
    const { result } = setup({ items: [item("300", "web", []), item("200", "api", []), item("100", "db", [])], total: null, hasMore: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.activeCount).toBeUndefined();
    expect(result.current.data?.preview).toHaveLength(3);
  });

  it("asks for nothing while it is disabled", () => {
    const { result, listDeployments } = setup({ items: [], total: 0, enabled: false });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listDeployments).not.toHaveBeenCalled();
  });

  function setup(input: { items: unknown[]; total: number | null; hasMore?: boolean; enabled?: boolean }) {
    const listDeployments = vi.fn(async (_params: unknown) => ({
      data: { deployments: input.items, pagination: { total: input.total, skip: 0, limit: PROJECT_PREVIEW_SIZE, hasMore: input.hasMore ?? false } }
    }));
    const api = createProxy({ v1: { listDeployments } }) as unknown as ApiService;
    const hook = setupQuery(() => useProjectDeploymentSummaryQuery("p1", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { ...hook, listDeployments };
  }

  function item(dseq: string, name: string | null, leases: { state: string }[]) {
    return {
      deployment: { id: { owner: "akash1owner", dseq }, state: "active" },
      leases: leases.map(lease => ({ ...lease, id: { provider: "akash1provider" } })),
      escrow_account: { state: { state: "open" } },
      name,
      settings: null,
      projectId: "p1"
    };
  }
});
