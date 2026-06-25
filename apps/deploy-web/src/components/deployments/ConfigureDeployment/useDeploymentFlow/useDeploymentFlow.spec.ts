import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useDeploymentFlow";
import { useDeploymentFlow } from "./useDeploymentFlow";

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

    act(() => result.current.actions.requestQuotes());

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(result.current.dseq).toBe("999");
    expect(createMutate).toHaveBeenCalledWith({ data: { sdl: "sdl-content", deposit: expect.any(Number) } }, expect.any(Object));
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure/999?bid-strategy=select", undefined, { shallow: true });
  });

  it("surfaces a retryable error when create fails", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new Error("boom")));
    const { result } = setup({ createMutate });
    act(() => result.current.actions.requestQuotes());
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

  function setup(input: {
    intent?: { sdlStrategy: "default" | "edit"; bidStrategy: "auto" | "select"; dseq?: string; templateId?: string };
    sdl?: string;
    replace?: ReturnType<typeof vi.fn>;
    createMutate?: ReturnType<typeof vi.fn>;
    closeMutate?: ReturnType<typeof vi.fn>;
  }) {
    const intent = input.intent ?? { sdlStrategy: "edit" as const, bidStrategy: "select" as const, dseq: undefined };
    const dependencies: typeof DEPENDENCIES = {
      useCreateDeployment: (() => mock<ReturnType<typeof DEPENDENCIES.useCreateDeployment>>({ mutate: (input.createMutate ?? vi.fn()) as never })) as never,
      useCloseDeployment: (() => mock<ReturnType<typeof DEPENDENCIES.useCloseDeployment>>({ mutate: (input.closeMutate ?? vi.fn()) as never })) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: (input.replace ?? vi.fn()) as never })) as never
    };
    return renderHook(() => useDeploymentFlow({ intent, sdl: input.sdl ?? "sdl-content" }, dependencies));
  }
});
