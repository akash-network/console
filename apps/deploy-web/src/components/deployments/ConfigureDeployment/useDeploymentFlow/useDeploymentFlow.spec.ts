import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "./deploymentIntent";
import type { DEPENDENCIES } from "./useDeploymentFlow";
import { buildConfigureUrl, useDeploymentFlow } from "./useDeploymentFlow";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useDeploymentFlow.name, () => {
  it("starts in configuring when there is no dseq", () => {
    const { result } = setup({});
    expect(result.current.phase).toBe("configuring");
  });

  it("resumes in quoting when the URL already carries a dseq", () => {
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" } });
    expect(result.current.phase).toBe("quoting");
    expect(result.current.dseq).toBe("777");
  });

  it("requestQuotes creates the deployment and advances to quoting, mirroring dseq to the URL", async () => {
    const replace = vi.fn();
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ replace, createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(result.current.dseq).toBe("999");
    expect(createMutate).toHaveBeenCalledWith({ data: { sdl: "sdl-content", deposit: expect.any(Number) } }, expect.any(Object));
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure/999?bid-strategy=select", undefined, { shallow: true });
  });

  it("mirrors the strategy current when a create resolves, not the one it was fired with", () => {
    const replace = vi.fn();
    let resolveCreate: ((result: { data: { dseq: string; manifest: string } }) => void) | undefined;
    const createMutate = vi.fn((_args, { onSuccess }) => {
      resolveCreate = onSuccess;
    });
    const { result } = setup({ replace, createMutate, intent: { sdlStrategy: "default", bidStrategy: "auto" } });

    // The auto autopilot fires the create as "auto"; the user then picks "Choose my provider" (switches to select) while
    // it's still in flight. When the create finally resolves, the URL must land on select — not bounce back to auto and
    // remount the auto flow.
    act(() => result.current.actions.requestQuotes("sdl-content"));
    act(() => result.current.actions.setBidStrategy("select"));
    act(() => resolveCreate?.({ data: { dseq: "999", manifest: "m" } }));

    expect(result.current.bidStrategy).toBe("select");
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining("bid-strategy=select"), undefined, { shallow: true });
    expect(replace).not.toHaveBeenCalledWith(expect.stringContaining("bid-strategy=auto"), undefined, { shallow: true });
  });

  it("surfaces a retryable error when create fails", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new Error("boom")));
    const { result } = setup({ createMutate });
    act(() => result.current.actions.requestQuotes("sdl-content"));
    await waitFor(() => expect(result.current.phase).toBe("error"));
  });

  it("times out to an error when no providers bid within the window", () => {
    vi.useFakeTimers();
    try {
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" } });
      expect(result.current.phase).toBe("quoting");

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.phase).toBe("error");
      expect(result.current.error?.message).toContain("No providers");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not time out once a provider has bid", () => {
    vi.useFakeTimers();
    try {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      const { result } = renderFlow({ intent: { dseq: "777" }, listBids: [openBid] });
      expect(result.current.phase).toBe("quoting");

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.phase).toBe("quoting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not re-arm the no-providers timeout after bids appear and then disappear", () => {
    vi.useFakeTimers();
    try {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      let bids: Array<typeof openBid> = [openBid];
      const dependencies: typeof DEPENDENCIES = {
        useCreateDeployment: (() => mockMutation()) as never,
        useCloseDeployment: (() => mockMutation()) as never,
        useCreateLease: (() => mockMutation()) as never,
        useUpdateDeployment: (() => mockMutation()) as never,
        useListBids: (() => ({ data: { data: bids }, isLoading: false, isError: false })) as never,
        useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() })) as never,
        useDeploymentLocalStorage: (() => mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocalStorage>>()) as never,
        manifestFromSdl: () => "M"
      };
      const { result, rerender } = renderHook(() => useDeploymentFlow({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" } }, dependencies));
      expect(result.current.phase).toBe("quoting");

      bids = []; // every provider's quote disappears (e.g. expired) after having bid
      rerender();
      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.phase).toBe("quoting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelAndEdit closes the deployment and returns to configuring", async () => {
    const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({}));
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    await waitFor(() => expect(result.current.phase).toBe("configuring"));
    expect(closeMutate).toHaveBeenCalledWith({ dseq: "777" }, expect.any(Object));
    expect(result.current.dseq).toBeNull();
  });

  it("clears the dseq from the URL as soon as cancel starts, before the close resolves", () => {
    const replace = vi.fn();
    const closeMutate = vi.fn(); // never resolves — proves the URL reset is optimistic, not tied to close-success
    const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777", templateId: "tpl" }, replace, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("closing");
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url.startsWith("/new-deployment/configure?")).toBe(true);
    expect(url).not.toContain("/configure/777");
  });

  it("enters the closing phase while the close mutation is in flight", () => {
    const closeMutate = vi.fn();
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("closing");
  });

  it("setBidStrategy mirrors the new strategy to the URL", () => {
    const replace = vi.fn();
    const { result } = setup({ replace });
    act(() => result.current.actions.setBidStrategy("auto"));
    expect(result.current.bidStrategy).toBe("auto");
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("bid-strategy=auto"), undefined, { shallow: true });
  });

  it("preserves the draft id in the URL when creating a deployment", async () => {
    const replace = vi.fn();
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ replace, createMutate, intent: { sdlStrategy: "edit", bidStrategy: "select", draftId: "draft-1" } });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringContaining("draftId=draft-1"), undefined, { shallow: true }));
  });

  it("records a provider selection per placement", () => {
    const { result } = renderFlow();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/1/1/1"));
    act(() => result.current.actions.selectProvider("placement-2", "akash1b/1/2/1"));
    expect(result.current.selections).toEqual({ "placement-1": "akash1a/1/1/1", "placement-2": "akash1b/1/2/1" });
  });

  it("replaces a placement's selection when picked again", () => {
    const { result } = renderFlow();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/1/1/1"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1c/1/1/2"));
    expect(result.current.selections).toEqual({ "placement-1": "akash1c/1/1/2" });
  });

  it("clears a single placement's selection without touching the others", () => {
    const { result } = renderFlow();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/1/1/1"));
    act(() => result.current.actions.selectProvider("placement-2", "akash1b/1/2/1"));
    act(() => result.current.actions.clearSelection("placement-1"));
    expect(result.current.selections).toEqual({ "placement-2": "akash1b/1/2/1" });
  });

  it("deploy creates leases from the current selections and the captured manifest", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_input, opts) => opts.onSuccess({ data: { dseq: "555", manifest: "MANIFEST_JSON" } }));
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, createLease, manifestFromSdl: () => "MANIFEST_JSON" });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(result.current.phase).toBe("deploying");
    expect(createLease.mutate).toHaveBeenCalledWith(
      { manifest: "MANIFEST_JSON", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
  });

  it("marks the deploy succeeded, then replaces to the deployment's events tab after a brief dwell", () => {
    vi.useFakeTimers();
    try {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      const { result, router } = renderFlow({ createDeployment, createLease });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.deploySucceeded).toBe(true);
      expect(router.replace).not.toHaveBeenCalledWith(UrlService.deploymentDetails("555", "EVENTS", "events"));

      act(() => vi.runAllTimers());
      expect(router.replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555", "EVENTS", "events"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("persists the deployment SDL keyed by the owner the lease response carries so the detail page can read it", () => {
    vi.useFakeTimers();
    try {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      const { result, deploymentLocalStorage } = renderFlow({ createDeployment, createLease });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("SDL_CONTENT"));

      expect(deploymentLocalStorage.update).toHaveBeenCalledWith("akash1owner", "555", { manifest: "SDL_CONTENT" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("still marks the deploy succeeded and redirects when caching the SDL throws", () => {
    vi.useFakeTimers();
    try {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      const { result, router, deploymentLocalStorage } = renderFlow({ createDeployment, createLease });
      deploymentLocalStorage.update.mockImplementation(() => {
        throw new Error("storage unavailable");
      });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.deploySucceeded).toBe(true);

      act(() => vi.runAllTimers());
      expect(router.replace).toHaveBeenCalledWith(UrlService.deploymentDetails("555", "EVENTS", "events"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns to quoting and surfaces a retryable deploy error when the lease request fails", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(result.current.phase).toBe("quoting");
    expect(result.current.deployError).toBeDefined();
  });

  it("retry re-fires the same lease request after a failure", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));
    act(() => result.current.actions.deploy("sdl"));

    expect(createLease.mutate).toHaveBeenCalledTimes(2);
  });

  it("clears a prior deploy error when a new provider is selected", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));
    expect(result.current.deployError).toBeDefined();

    act(() => result.current.actions.selectProvider("placement-1", "akash1b/555/1/3"));
    expect(result.current.deployError).toBeUndefined();
  });

  it("clears selections when the deployment is closed so a re-quote cannot reuse stale bids", () => {
    const closeDeployment = mockMutation();
    closeDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({}));
    const { result } = renderFlow({ closeDeployment, intent: { dseq: "555" } });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("configuring");
    expect(result.current.selections).toEqual({});
  });

  it("updates then leases with the sdl-derived manifest when deploying after a reload that resumed straight into quoting", () => {
    const updateDeployment = mockMutation();
    updateDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({}));
    const createLease = mockMutation();
    const manifestFromSdl = vi.fn(() => "DERIVED_MANIFEST");
    const { result } = renderFlow({ updateDeployment, createLease, manifestFromSdl, intent: { dseq: "555" } });

    expect(result.current.phase).toBe("quoting");

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("SDL_CONTENT"));

    expect(manifestFromSdl).toHaveBeenCalledWith("SDL_CONTENT");
    expect(updateDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", data: { sdl: "SDL_CONTENT" } }, expect.anything());
    expect(createLease.mutate).toHaveBeenCalledWith(
      { manifest: "DERIVED_MANIFEST", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
  });

  it("updates the deployment before leasing when the manifest changed since create", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } }));
    const updateDeployment = mockMutation();
    updateDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({}));
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, updateDeployment, createLease, manifestFromSdl: () => "M2" });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("edited-sdl"));

    expect(updateDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", data: { sdl: "edited-sdl" } }, expect.anything());
    expect(createLease.mutate).toHaveBeenCalledWith({ manifest: "M2", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] }, expect.anything());
  });

  it("leases without updating when the manifest is unchanged since create", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } }));
    const updateDeployment = mockMutation();
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, updateDeployment, createLease, manifestFromSdl: () => "M1" });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(updateDeployment.mutate).not.toHaveBeenCalled();
    expect(createLease.mutate).toHaveBeenCalledWith({ manifest: "M1", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] }, expect.anything());
  });

  it("does not create the lease until the pre-lease update succeeds", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } }));
    const updateDeployment = mockMutation();
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, updateDeployment, createLease, manifestFromSdl: () => "M2" });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("edited-sdl"));

    expect(updateDeployment.mutate).toHaveBeenCalledTimes(1);
    expect(createLease.mutate).not.toHaveBeenCalled();
  });

  it("returns to quoting with a retryable error when the pre-lease update fails", () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } }));
    const updateDeployment = mockMutation();
    updateDeployment.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, updateDeployment, createLease, manifestFromSdl: () => "M2" });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("edited-sdl"));

    expect(createLease.mutate).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("quoting");
    expect(result.current.deployError).toBeDefined();
  });

  it("clears a placement's selection when its bid is no longer open", async () => {
    const { result } = renderFlow({
      intent: { dseq: "555" },
      listBids: [
        { bid: { state: "closed", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1a", dseq: "555", gseq: 1, oseq: 3 } } },
        { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1b", dseq: "555", gseq: 1, oseq: 3 } } }
      ]
    });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

    await waitFor(() => expect(result.current.selections).toEqual({}));
  });

  it("prunes only the placement whose bid closed, keeping other open selections", async () => {
    const { result } = renderFlow({
      intent: { dseq: "555" },
      listBids: [
        { bid: { state: "closed", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1a", dseq: "555", gseq: 1, oseq: 3 } } },
        { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1b", dseq: "555", gseq: 2, oseq: 4 } } }
      ]
    });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.selectProvider("placement-2", "akash1b/555/2/4"));

    await waitFor(() => expect(result.current.selections).toEqual({ "placement-2": "akash1b/555/2/4" }));
  });

  it("keeps a selection whose bid is still open", () => {
    const { result } = renderFlow({
      intent: { dseq: "555" },
      listBids: [{ bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1a", dseq: "555", gseq: 1, oseq: 3 } } }]
    });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

    expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });
  });

  it("does not prune selections while no bids have loaded", () => {
    const { result } = renderFlow({ intent: { dseq: "555" }, listBids: [] });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

    expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });
  });

  function setup(input: {
    intent?: { sdlStrategy: "default" | "edit"; bidStrategy: "auto" | "select"; dseq?: string; templateId?: string; draftId?: string };
    replace?: ReturnType<typeof vi.fn>;
    createMutate?: ReturnType<typeof vi.fn>;
    closeMutate?: ReturnType<typeof vi.fn>;
  }) {
    const intent = input.intent ?? { sdlStrategy: "edit" as const, bidStrategy: "select" as const, dseq: undefined };
    const dependencies: typeof DEPENDENCIES = {
      useCreateDeployment: (() => mock<ReturnType<typeof DEPENDENCIES.useCreateDeployment>>({ mutate: (input.createMutate ?? vi.fn()) as never })) as never,
      useCloseDeployment: (() => mock<ReturnType<typeof DEPENDENCIES.useCloseDeployment>>({ mutate: (input.closeMutate ?? vi.fn()) as never })) as never,
      useCreateLease: (() => mock<ReturnType<typeof DEPENDENCIES.useCreateLease>>({ mutate: vi.fn() as never })) as never,
      useUpdateDeployment: (() => mock<ReturnType<typeof DEPENDENCIES.useUpdateDeployment>>({ mutate: vi.fn() as never })) as never,
      useListBids: (() => ({ data: { data: [] }, isLoading: false, isError: false })) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: (input.replace ?? vi.fn()) as never })) as never,
      useDeploymentLocalStorage: (() => mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocalStorage>>()) as never,
      manifestFromSdl: () => "manifest"
    };
    return renderHook(() => useDeploymentFlow({ intent }, dependencies));
  }

  function renderFlow(input?: {
    intent?: Partial<DeploymentIntent>;
    createDeployment?: ReturnType<typeof mockMutation>;
    createLease?: ReturnType<typeof mockMutation>;
    closeDeployment?: ReturnType<typeof mockMutation>;
    updateDeployment?: ReturnType<typeof mockMutation>;
    manifestFromSdl?: (sdl: string) => string | null;
    listBids?: Array<{ bid: { state: string; price: { amount: string; denom: string }; id: { provider: string; dseq: string; gseq: number; oseq: number } } }>;
  }) {
    const intent: DeploymentIntent = { sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, ...input?.intent };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() });
    const deploymentLocalStorage = mock<ReturnType<typeof DEPENDENCIES.useDeploymentLocalStorage>>();
    const dependencies: typeof DEPENDENCIES = {
      useCreateDeployment: (() => input?.createDeployment ?? mockMutation()) as never,
      useCloseDeployment: (() => input?.closeDeployment ?? mockMutation()) as never,
      useCreateLease: (() => input?.createLease ?? mockMutation()) as never,
      useUpdateDeployment: (() => input?.updateDeployment ?? mockMutation()) as never,
      useListBids: (() => ({ data: { data: input?.listBids ?? [] }, isLoading: false, isError: false })) as never,
      useRouter: () => router,
      useDeploymentLocalStorage: (() => deploymentLocalStorage) as never,
      manifestFromSdl: input?.manifestFromSdl ?? (() => "M")
    };
    const utils = renderHook(() => useDeploymentFlow({ intent }, dependencies));
    return { ...utils, router, deploymentLocalStorage };
  }

  function mockMutation() {
    return mock<{ mutate: ReturnType<typeof vi.fn> }>({ mutate: vi.fn() });
  }

  /** The create-lease success payload shape the flow reads the owner from. */
  function deployedResult(owner: string) {
    return { data: { deployment: { id: { owner } } } };
  }
});

describe(buildConfigureUrl.name, () => {
  it("preserves the draft id alongside the dseq and bid strategy", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", templateId: "tpl", draftId: "draft-1" }, "999", "auto");

    expect(url).toContain("/new-deployment/configure/999");
    expect(url).toContain("bid-strategy=auto");
    expect(url).toContain("draftId=draft-1");
  });

  it("omits the draft id when the intent carries none", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select" }, undefined, "select");

    expect(url).not.toContain("draftId");
  });
});
