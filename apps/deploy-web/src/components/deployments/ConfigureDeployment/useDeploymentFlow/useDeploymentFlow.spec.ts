import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

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

  it("surfaces a retryable error when create fails", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new Error("boom")));
    const { result } = setup({ createMutate });
    act(() => result.current.actions.requestQuotes("sdl-content"));
    await waitFor(() => expect(result.current.phase).toBe("error"));
  });

  it("cancelAndEdit closes the deployment and returns to configuring", async () => {
    const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({}));
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    await waitFor(() => expect(result.current.phase).toBe("configuring"));
    expect(closeMutate).toHaveBeenCalledWith({ dseq: "777" }, expect.any(Object));
    expect(result.current.dseq).toBeNull();
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
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(result.current.phase).toBe("deploying");
    expect(createLease.mutate).toHaveBeenCalledWith(
      { manifest: "MANIFEST_JSON", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
  });

  it("marks the deploy succeeded, then redirects to the deployment detail after a brief dwell", () => {
    vi.useFakeTimers();
    try {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess());
      const { result, router } = renderFlow({ createDeployment, createLease });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.deploySucceeded).toBe(true);
      expect(router.push).not.toHaveBeenCalled();

      act(() => vi.runAllTimers());
      expect(router.push).toHaveBeenCalledWith("/deployments/555");
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

  it("derives the manifest from the sdl when deploying after a reload that resumed straight into quoting", () => {
    const createLease = mockMutation();
    const manifestFromSdl = vi.fn(() => "DERIVED_MANIFEST");
    const { result } = renderFlow({ createLease, manifestFromSdl, intent: { dseq: "555" } });

    expect(result.current.phase).toBe("quoting");

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("SDL_CONTENT"));

    expect(manifestFromSdl).toHaveBeenCalledWith("SDL_CONTENT");
    expect(createLease.mutate).toHaveBeenCalledWith(
      { manifest: "DERIVED_MANIFEST", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
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
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: (input.replace ?? vi.fn()) as never })) as never,
      manifestFromSdl: () => "manifest"
    };
    return renderHook(() => useDeploymentFlow({ intent }, dependencies));
  }

  function renderFlow(input?: {
    intent?: Partial<DeploymentIntent>;
    createDeployment?: ReturnType<typeof mockMutation>;
    createLease?: ReturnType<typeof mockMutation>;
    closeDeployment?: ReturnType<typeof mockMutation>;
    manifestFromSdl?: (sdl: string) => string | null;
  }) {
    const intent: DeploymentIntent = { sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, ...input?.intent };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() });
    const dependencies: typeof DEPENDENCIES = {
      useCreateDeployment: (() => input?.createDeployment ?? mockMutation()) as never,
      useCloseDeployment: (() => input?.closeDeployment ?? mockMutation()) as never,
      useCreateLease: (() => input?.createLease ?? mockMutation()) as never,
      useRouter: () => router,
      manifestFromSdl: input?.manifestFromSdl ?? (() => "DERIVED_MANIFEST")
    };
    const utils = renderHook(() => useDeploymentFlow({ intent }, dependencies));
    return { ...utils, router };
  }

  function mockMutation() {
    return mock<{ mutate: ReturnType<typeof vi.fn> }>({ mutate: vi.fn() });
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
