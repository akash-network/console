import type { PropsWithChildren } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createStore, Provider as JotaiStoreProvider } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { QueryKeys } from "@src/queries/queryKeys";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { shouldReportError } from "@src/services/query-error-policy/query-error-policy";
import { settingsIdAtom } from "@src/store/settingsStore";
import type { Project } from "@src/types/project";
import { servicesPatchBetween } from "@src/utils/sdl/sdlServicesPatch";
import { UrlService } from "@src/utils/urlUtils";
import type { DeploymentIntent } from "./deploymentIntent";
import type { DEPENDENCIES, DeploymentFlowActions } from "./useDeploymentFlow";
import { buildConfigureUrl, useDeploymentFlow } from "./useDeploymentFlow";

import { act, renderHook, waitFor } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";

const SEAL_CONTEXT = {
  kid: "sdl-secrets.v1",
  sub: "user-1",
  jwk: { kty: "RSA", n: "n", e: "AQAB", use: "enc", alg: "RSA-OAEP-256" },
  requiredClaims: ["kid", "sub", "exp"]
};

const STALE_KEY_MESSAGE = "Sealed to a key the console no longer holds; refetch the SDL secrets context";

const REFERENCED_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "API_KEY=ac-secret://s0_e0"\n';

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

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(result.current.dseq).toBe("999");
    expect(createMutate).toHaveBeenCalledWith(
      { async: "true", data: { sdl: "sdl-content", sealedSecrets: "SEALED", deposit: expect.any(Number) } },
      expect.any(Object)
    );
    expect(replace).toHaveBeenCalledWith("/new-deployment/configure/999?bid-strategy=select", undefined, { shallow: true });
  });

  it("files the deployment into the project chosen for it", async () => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate).toHaveBeenCalledWith(
      { async: "true", data: expect.objectContaining({ sdl: "sdl-content", projectId: "project-1" }) },
      expect.any(Object)
    );
  });

  it("records the gallery template the deployment starts from", async () => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate, intent: { sdlStrategy: "edit", bidStrategy: "select", templateId: "akash-network-awesome-akash-comfyui" } });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate).toHaveBeenCalledWith(
      { async: "true", data: expect.objectContaining({ templateId: "akash-network-awesome-akash-comfyui" }) },
      expect.any(Object)
    );
  });

  it("records no template for a hardcoded starter, which the gallery does not have", async () => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate, intent: { sdlStrategy: "edit", bidStrategy: "select", templateId: "hello-world" } });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].data).not.toHaveProperty("templateId");
  });

  it("asks for a project again when the api requires one", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(400, { message: "Choose a project", code: "project_required" }, "bad request")));
    const { result, forgetProject } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(forgetProject).toHaveBeenCalledWith("Choose the project this deployment goes to.");
  });

  it("asks for another project when the chosen one was deleted or became unreachable", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(404, { message: "Project not found" }, "not found")));
    const { result, forgetProject } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(forgetProject).toHaveBeenCalledWith("The project you picked was deleted or you lost access to it. Choose another one.");
  });

  it("keeps the chosen project through another not found", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(404, { message: "Wallet not found" }, "not found")));
    const { result, forgetProject } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(forgetProject).not.toHaveBeenCalled();
  });

  it("keeps the chosen project through any other refusal", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(400, { message: "Invalid SDL", code: "validation_error" }, "bad request")));
    const { result, forgetProject } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(forgetProject).not.toHaveBeenCalled();
  });

  it("leaves the project out when none is chosen, so the api files the deployment into the default project", async () => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await settleSeal();

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    expect(createMutate.mock.calls[0][0].data).not.toHaveProperty("projectId");
  });

  it("carries the typed name into the create request, so the api records the name the user chose", async () => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content", { name: "  my-app  " }));

    await settleSeal();

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(createMutate).toHaveBeenCalledWith(
      { async: "true", data: { sdl: "sdl-content", name: "my-app", sealedSecrets: "SEALED", deposit: expect.any(Number) } },
      expect.any(Object)
    );
  });

  it.each([undefined, "", "   "])("omits a name of %p, which the api refuses rather than treating as unnamed", async name => {
    const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content", { name }));

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(createMutate.mock.calls[0][0].data).not.toHaveProperty("name");
  });

  it("mirrors the strategy current when a create resolves, not the one it was fired with", () => {
    const replace = vi.fn();
    let resolveCreate: ((result: { data: { dseq: string; manifest: string } }) => void) | undefined;
    const createMutate = vi.fn((_args, { onSuccess }) => {
      resolveCreate = onSuccess;
    });
    const { result } = setup({ replace, createMutate, intent: { sdlStrategy: "default", bidStrategy: "auto" } });

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
    expect(result.current.error?.kind).toBe("create");
  });

  it("marks a create the api refused for want of funds so the form can offer to add credits", async () => {
    const message = "Not enough balance to cover the deployment deposit. Add credits or turn on auto recharge to continue.";
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(402, { message, code: "payment_required" }, "POST /v1/deployments → 402")));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.phase).toBe("error"));
    expect(result.current.error).toEqual({ kind: "needs-funds", message });
  });

  it("carries how far the balance falls short so the user is told what is missing", async () => {
    const message = "Not enough balance to cover the deployment deposit. Add credits or turn on auto recharge to continue.";
    const refusal = new ApiError(
      402,
      { message, code: "insufficient_balance", data: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } },
      "POST /v1/deployments → 402"
    );
    const createMutate = vi.fn((_args, { onError }) => onError(refusal));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() =>
      expect(result.current.error).toEqual({ kind: "needs-funds", message, shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } })
    );
  });

  it("tells a refusal a top up already on its way will clear apart from one that needs credits", async () => {
    const message = "Not enough balance to cover the deployment deposit. A top up from your saved payment method is on the way, so try again in a moment.";
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(402, { message, code: "balance_top_up_pending" }, "POST /v1/deployments → 402")));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.error).toEqual({ kind: "top-up-pending", message }));
  });

  it("marks a create refused by the project's monthly budget with the project the api named", async () => {
    const message = "This would take the project past its monthly budget, so it was not signed. An owner or admin can raise the budget.";
    const refusal = new ApiError(403, { message, code: "project_budget_exceeded", data: { projectIds: ["storefront"] } }, "POST /v1/deployments → 403");
    const createMutate = vi.fn((_args, { onError }) => onError(refusal));
    const { result, forgetProject } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.error).toEqual({ kind: "budget-exceeded", message, projectId: "storefront" }));
    expect(result.current.phase).toBe("error");
    expect(forgetProject).not.toHaveBeenCalled();
  });

  it("falls back to the chosen project when a budget refusal names none", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(403, { message: "over", code: "project_budget_exceeded" }, "forbidden")));
    const { result } = setup({ createMutate, deployTargetProjectId: "project-1" });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.error).toEqual({ kind: "budget-exceeded", message: "over", projectId: "project-1" }));
  });

  it("treats a trial gpu refusal the same way, since adding funds is what unlocks it too", async () => {
    const message = "GPU interconnect not available on free trial: Add funds to unlock GPU interconnect";
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(402, { message, code: "payment_required" }, "POST /v1/deployments → 402")));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.error).toEqual({ kind: "needs-funds", message }));
  });

  it("sends a refused create again as it went out once the user has added funds", async () => {
    const refusal = new ApiError(402, { message: "Not enough balance", code: "payment_required" }, "POST /v1/deployments → 402");
    const createMutate = vi
      .fn()
      .mockImplementationOnce((_args, { onError }) => onError(refusal))
      .mockImplementationOnce((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
    const { result } = setup({ createMutate });
    act(() => result.current.actions.requestQuotes("sdl-content", { name: "my-app" }));
    await waitFor(() => expect(result.current.error?.kind).toBe("needs-funds"));

    act(() => result.current.actions.requestQuotesAgain());

    await waitFor(() => expect(result.current.phase).toBe("quoting"));
    expect(createMutate).toHaveBeenCalledTimes(2);
    expect(createMutate.mock.calls[1][0]).toEqual(createMutate.mock.calls[0][0]);
    expect(createMutate.mock.calls[1][0].data).toMatchObject({ sdl: "sdl-content", name: "my-app" });
  });

  it("closes a deployment it holds before sending the last create again, so two are never open at once", async () => {
    const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
    const createMutate = vi
      .fn()
      .mockImplementationOnce((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }))
      .mockImplementationOnce((_args, { onSuccess }) => onSuccess({ data: { dseq: "1000", manifest: "m" } }));
    const { result } = setup({ closeMutate, createMutate });
    act(() => result.current.actions.requestQuotes("sdl-content"));
    await waitFor(() => expect(result.current.dseq).toBe("999"));

    act(() => result.current.actions.requestQuotesAgain());
    await settleSeal();

    expect(closeMutate).toHaveBeenCalledTimes(1);
    expect(closeMutate.mock.invocationCallOrder[0]).toBeLessThan(createMutate.mock.invocationCallOrder[1]);
  });

  it("has nothing to send again before any create went out", async () => {
    const createMutate = vi.fn();
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotesAgain());
    await settleSeal();

    expect(createMutate).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("configuring");
  });

  it("leaves any other api failure on the generic create error", async () => {
    const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(400, { message: "Invalid SDL" }, "POST /v1/deployments → 400")));
    const { result } = setup({ createMutate });

    act(() => result.current.actions.requestQuotes("sdl-content"));

    await waitFor(() => expect(result.current.error).toEqual({ kind: "create", message: "Invalid SDL" }));
  });

  describe("error reporting for a failed create", () => {
    it("stays quiet about a create the api refused, since the page shows the reason", () => {
      const { createMeta } = setupCreateErrorReporting();

      expect(shouldReportError(new ApiError(400, { message: "Invalid SDL" }, "POST /v1/deployments → 400"), createMeta)).toBe(false);
    });

    it("reports a create that ran out of retries while the trial wallet was still provisioning", () => {
      const { createMeta } = setupCreateErrorReporting();
      const error = new ApiError(409, { message: "Wallet is still being provisioned", code: "wallet_provisioning" }, "POST /v1/deployments → 409");

      expect(shouldReportError(error, createMeta)).toBe(true);
    });

    it("reports a create the api failed to answer", () => {
      const { createMeta } = setupCreateErrorReporting();

      expect(shouldReportError(new ApiError(503, {}, "POST /v1/deployments → 503"), createMeta)).toBe(true);
    });

    function setupCreateErrorReporting() {
      const { services } = renderFlow();
      return { createMeta: hookOptionsOf(services.api.v1.createDeployment.useMutation).meta };
    }
  });

  it("keeps the auto flow's deployment open and quoting once the wait for a first bid runs out, since a late bid can still land", () => {
    vi.useFakeTimers();
    try {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate });
      expect(result.current.phase).toBe("quoting");

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.noBidsReceived).toBe(true);
      expect(result.current.phase).toBe("quoting");
      expect(result.current.dseq).toBe("777");
      expect(result.current.error).toBeUndefined();
      expect(closeMutate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the deployment open on the bid page and reports that no provider bid, in the manual flow", () => {
    vi.useFakeTimers();
    try {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });
      expect(result.current.noBidsReceived).toBe(false);

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.noBidsReceived).toBe(true);
      expect(result.current.phase).toBe("quoting");
      expect(result.current.dseq).toBe("777");
      expect(result.current.error).toBeUndefined();
      expect(closeMutate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports what screening promised when no provider bids on the requested deployment", async () => {
    vi.useFakeTimers();
    try {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, analyticsService } = setup({ createMutate, closeMutate: vi.fn() });

      act(() => result.current.actions.requestQuotes("sdl-content", { screening: { placementCount: 2, providerCount: 3, notBiddingProviderCount: 3 } }));

      await settleSeal();
      act(() => vi.advanceTimersByTime(60_000));

      expect(analyticsService.track).toHaveBeenCalledWith("bids_not_received", {
        category: "deployments",
        dseq: "999",
        bidStrategy: "select",
        waitedSeconds: 60,
        placementCount: 2,
        screenedProviderCount: 3,
        notBiddingProviderCount: 3
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a resumed deployment that draws no bid without screening counts, since this session never saw its request", () => {
    vi.useFakeTimers();
    try {
      const { analyticsService } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" } });

      act(() => vi.advanceTimersByTime(60_000));

      expect(analyticsService.track).toHaveBeenCalledWith("bids_not_received", {
        category: "deployments",
        dseq: "777",
        bidStrategy: "auto",
        waitedSeconds: 60,
        placementCount: undefined,
        screenedProviderCount: undefined
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not report missing bids before the wait is over", () => {
    vi.useFakeTimers();
    try {
      const { analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate: vi.fn() });

      act(() => vi.advanceTimersByTime(59_999));

      expect(analyticsService.track).not.toHaveBeenCalledWith("bids_not_received", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets the previous attempt's screening once a later request carries none", async () => {
    vi.useFakeTimers();
    try {
      let nextDseq = 999;
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: String(nextDseq++), manifest: "m" } }));
      const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
      const { result, analyticsService } = setup({ createMutate, closeMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { screening: { placementCount: 1, providerCount: 4 } }));

      await settleSeal();
      act(() => vi.advanceTimersByTime(60_000));
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-content"));
      await settleSeal();
      act(() => vi.advanceTimersByTime(60_000));

      expect(analyticsService.track).toHaveBeenLastCalledWith(
        "bids_not_received",
        expect.objectContaining({ dseq: "1000", placementCount: undefined, screenedProviderCount: undefined })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it.each<[string, (actions: ReturnType<typeof setup>["result"]["current"]["actions"]) => void]>([
    ["the deployment is closed to edit it", actions => actions.cancelAndEdit()],
    ["bids are requested again", actions => actions.requestQuotes("sdl-content")]
  ])("stops reporting missing bids once %s", (_, finishAttempt) => {
    vi.useFakeTimers();
    try {
      const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });
      act(() => vi.advanceTimersByTime(60_000));
      expect(result.current.noBidsReceived).toBe(true);

      act(() => finishAttempt(result.current.actions));

      expect(result.current.noBidsReceived).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops reporting missing bids once a late bid lands", () => {
    vi.useFakeTimers();
    try {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      let bids: Array<typeof openBid> = [];
      const services = mockServices();
      const dependencies: typeof DEPENDENCIES = {
        useServices: (() => services) as never,
        useListBids: (() => ({ data: { data: bids }, isLoading: false, isError: false })) as never,
        useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() })) as never,
        useQueryClient: (() => mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>()) as never,
        manifestFromSdl: () => "M",
        deploymentResourcesFromSdl: () => ({ gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 }),
        sealSdlSecrets: async () => "SEALED",
        servicesPatchBetween,
        useLatestActivitiesQuery: () => mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>({ data: undefined }),
        useMarkActivityOutcomes: () => mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>(),
        useConfigureDeployTarget: () => mock<ReturnType<typeof DEPENDENCIES.useConfigureDeployTarget>>({ project: undefined }),
        useHoldActivityEvents: () => vi.fn(),
        useRecordOneClickDeploy: () => vi.fn()
      };
      const { result, rerender } = renderDeploymentFlow({ sdlStrategy: "edit", bidStrategy: "select", dseq: "777", vm: false }, dependencies);
      act(() => vi.advanceTimersByTime(60_000));
      expect(result.current.noBidsReceived).toBe(true);

      bids = [openBid];
      rerender();

      expect(result.current.noBidsReceived).toBe(false);
      expect(result.current.phase).toBe("quoting");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports no missing bids for a deployment discarded before the wait ran out", () => {
    vi.useFakeTimers();
    try {
      const { result, analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate: vi.fn() });
      act(() => result.current.actions.discard());

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.noBidsReceived).toBe(false);
      expect(analyticsService.track).not.toHaveBeenCalledWith("bids_not_received", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  describe("when the first bid lands after the wait for one ran out", () => {
    it("reports how late it came, with what screening promised", async () => {
      vi.useFakeTimers();
      try {
        const bidList: { bids: Array<ReturnType<typeof openBidOn>> } = { bids: [] };
        const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
        const { result, rerender, analyticsService } = setup({ createMutate, closeMutate: vi.fn(), bidList });
        act(() => result.current.actions.requestQuotes("sdl-content", { screening: { placementCount: 2, providerCount: 28, notBiddingProviderCount: 5 } }));
        await settleSeal();
        act(() => vi.advanceTimersByTime(67_000));

        bidList.bids = [openBidOn("999")];
        rerender();

        expect(analyticsService.track).toHaveBeenCalledWith("bids_received_after_timeout", {
          category: "deployments",
          dseq: "999",
          bidStrategy: "select",
          secondsAfterTimeout: 7,
          placementCount: 2,
          screenedProviderCount: 28,
          notBiddingProviderCount: 5,
          isAutoDeploy: false
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("marks it as one the auto starter picks up", () => {
      vi.useFakeTimers();
      try {
        const bidList: { bids: Array<ReturnType<typeof openBidOn>> } = { bids: [] };
        const { rerender, analyticsService } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, bidList });
        act(() => vi.advanceTimersByTime(61_000));

        bidList.bids = [openBidOn("777")];
        rerender();

        expect(analyticsService.track).toHaveBeenCalledWith("bids_received_after_timeout", {
          category: "deployments",
          dseq: "777",
          bidStrategy: "auto",
          secondsAfterTimeout: 1,
          placementCount: undefined,
          screenedProviderCount: undefined,
          notBiddingProviderCount: undefined,
          isAutoDeploy: true
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it.each<{ sdlStrategy: "default" | "edit"; bidStrategy: "auto" | "select" }>([
      { sdlStrategy: "edit", bidStrategy: "auto" },
      { sdlStrategy: "default", bidStrategy: "select" }
    ])("does not count it as the auto starter's for a $sdlStrategy SDL with $bidStrategy bids", intent => {
      vi.useFakeTimers();
      try {
        const bidList: { bids: Array<ReturnType<typeof openBidOn>> } = { bids: [] };
        const { rerender, analyticsService } = setup({ intent: { ...intent, dseq: "777" }, closeMutate: vi.fn(), bidList });
        act(() => vi.advanceTimersByTime(61_000));

        bidList.bids = [openBidOn("777")];
        rerender();

        expect(analyticsService.track).toHaveBeenCalledWith("bids_received_after_timeout", expect.objectContaining({ isAutoDeploy: false }));
      } finally {
        vi.useRealTimers();
      }
    });

    it("reports nothing late for a bid that lands before the wait runs out", () => {
      vi.useFakeTimers();
      try {
        const bidList: { bids: Array<ReturnType<typeof openBidOn>> } = { bids: [] };
        const { rerender, analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate: vi.fn(), bidList });
        act(() => vi.advanceTimersByTime(59_999));

        bidList.bids = [openBidOn("777")];
        rerender();
        act(() => vi.advanceTimersByTime(60_000));

        expect(analyticsService.track).toHaveBeenCalledWith("bids_received", expect.anything());
        expect(analyticsService.track).not.toHaveBeenCalledWith("bids_received_after_timeout", expect.anything());
      } finally {
        vi.useRealTimers();
      }
    });

    it("forgets an earlier attempt's late wait once bids are requested again", async () => {
      vi.useFakeTimers();
      try {
        let nextDseq = 999;
        const bidList: { bids: Array<ReturnType<typeof openBidOn>> } = { bids: [] };
        const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: String(nextDseq++), manifest: "m" } }));
        const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
        const { result, rerender, analyticsService } = setup({ createMutate, closeMutate, bidList });
        act(() => result.current.actions.requestQuotes("sdl-content"));
        await settleSeal();
        act(() => vi.advanceTimersByTime(60_000));
        act(() => result.current.actions.cancelAndEdit());
        act(() => result.current.actions.requestQuotes("sdl-content"));
        await settleSeal();

        bidList.bids = [openBidOn("1000")];
        rerender();

        expect(analyticsService.track).toHaveBeenCalledWith("bids_received", expect.objectContaining({ dseq: "1000" }));
        expect(analyticsService.track).not.toHaveBeenCalledWith("bids_received_after_timeout", expect.anything());
      } finally {
        vi.useRealTimers();
      }
    });
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

  it.each(["closed", "active"])("does not report missing bids for a resumed deployment whose only bid is %s, since a provider did bid", state => {
    vi.useFakeTimers();
    try {
      const bid = { bid: { state, price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      const { result, analyticsService } = renderFlow({ intent: { dseq: "777" }, listBids: [bid] });

      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.noBidsReceived).toBe(false);
      expect(analyticsService.track).not.toHaveBeenCalledWith("bids_not_received", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not report missing bids before any were requested", () => {
    vi.useFakeTimers();
    try {
      const { result, analyticsService } = setup({});

      act(() => vi.advanceTimersByTime(120_000));

      expect(result.current.phase).toBe("configuring");
      expect(result.current.noBidsReceived).toBe(false);
      expect(analyticsService.track).not.toHaveBeenCalledWith("bids_not_received", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not report missing bids while the bid list has never loaded, since nothing confirms that nobody bid", () => {
    vi.useFakeTimers();
    try {
      const { result, analyticsService } = renderWithBidList({ data: undefined });

      act(() => vi.advanceTimersByTime(120_000));

      expect(result.current.noBidsReceived).toBe(false);
      expect(analyticsService.track).not.toHaveBeenCalledWith("bids_not_received", expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts the wait for a first bid once the bid list first loads", () => {
    vi.useFakeTimers();
    try {
      const bidList: { data: { data: never[] } | undefined } = { data: undefined };
      const { result, rerender } = renderWithBidList(bidList);
      act(() => vi.advanceTimersByTime(30_000));

      bidList.data = { data: [] };
      rerender();
      act(() => vi.advanceTimersByTime(59_999));
      expect(result.current.noBidsReceived).toBe(false);

      act(() => vi.advanceTimersByTime(1));
      expect(result.current.noBidsReceived).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not re-arm the no-providers timeout after bids appear and then disappear", () => {
    vi.useFakeTimers();
    try {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      let bids: Array<typeof openBid> = [openBid];
      const services = mockServices();
      const dependencies: typeof DEPENDENCIES = {
        useServices: (() => services) as never,
        useListBids: (() => ({ data: { data: bids }, isLoading: false, isError: false })) as never,
        useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() })) as never,
        useQueryClient: (() => mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>()) as never,
        manifestFromSdl: () => "M",
        deploymentResourcesFromSdl: () => ({ gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 }),
        sealSdlSecrets: async () => "SEALED",
        servicesPatchBetween,
        useLatestActivitiesQuery: () => mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>({ data: undefined }),
        useMarkActivityOutcomes: () => mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>(),
        useConfigureDeployTarget: () => mock<ReturnType<typeof DEPENDENCIES.useConfigureDeployTarget>>({ project: undefined }),
        useHoldActivityEvents: () => vi.fn(),
        useRecordOneClickDeploy: () => vi.fn()
      };
      const { result, rerender } = renderDeploymentFlow({ sdlStrategy: "edit", bidStrategy: "select", dseq: "777", vm: false }, dependencies);
      expect(result.current.phase).toBe("quoting");

      bids = [];
      rerender();
      act(() => vi.advanceTimersByTime(60_000));

      expect(result.current.phase).toBe("quoting");
      expect(result.current.noBidsReceived).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancelAndEdit closes the deployment and returns to configuring", async () => {
    const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    await waitFor(() => expect(result.current.phase).toBe("configuring"));
    expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    expect(result.current.dseq).toBeNull();
  });

  it("clears the dseq from the URL as soon as cancel starts, before the close resolves", () => {
    const replace = vi.fn();
    const closeMutate = vi.fn();
    const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777", templateId: "tpl" }, replace, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("configuring");
    const url = replace.mock.calls.at(-1)?.[0] as string;
    expect(url.startsWith("/new-deployment/configure?")).toBe(true);
    expect(url).not.toContain("/configure/777");
  });

  it("returns to configuring immediately while the close is still in flight, so the form is editable at once", () => {
    const closeMutate = vi.fn();
    const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("configuring");
    expect(result.current.dseq).toBeNull();
    expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
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

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(result.current.phase).toBe("deploying");
    expect(createLease.mutate).toHaveBeenCalledWith(
      { async: "true", manifest: "MANIFEST_JSON", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
  });

  it("marks the deploy succeeded, then replaces to the deployment's events tab after a brief dwell", async () => {
    vi.useFakeTimers();
    try {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      const { result, router } = renderFlow({ createDeployment, createLease });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
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

  it("invalidates the leases and deployment-list caches on lease success so the onboarding gate sees the new deployment", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
    const { result, queryClient } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getAllLeasesKey("akash1owner") });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getDeploymentListKey("akash1owner") });
  });

  it("refreshes every page of deployments the api has answered with, so the new one shows on the list", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
    const { result, queryClient, services } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: services.api.v1.listDeployments.getKey() });
  });

  it("refreshes the account's spend rate on lease success, so its totals count the new deployment", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
    const { result, queryClient } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "getSpendRate"] });
  });

  it("returns to quoting and surfaces a retryable deploy error when the lease request fails", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(result.current.phase).toBe("quoting");
    expect(result.current.deployError).toBeDefined();
  });

  it("marks the create it showed as handled, so the activity host doesn't announce it again", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const { result, markOutcomeHandled } = renderFlow({ createDeployment });

    act(() => result.current.actions.requestQuotes("sdl"));
    await settleSeal();

    expect(markOutcomeHandled).toHaveBeenCalledWith("deployment_create", "555", "succeeded");
  });

  it.each([
    { outcome: "succeeded", settle: (o: LeaseCallbacks) => o.onSuccess(deployedResult("akash1owner")) },
    { outcome: "failed", settle: (o: LeaseCallbacks) => o.onError(new Error("boom")) }
  ])("marks a deploy whose lease request $outcome as handled with that outcome", async ({ outcome, settle }) => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o: LeaseCallbacks) => settle(o));
    const { result, markOutcomeHandled } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(markOutcomeHandled).toHaveBeenCalledWith("lease_create", "555", outcome);
  });

  it("drops what an earlier deploy marked before it sends the lease request, and marks nothing until it answers", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    const { result, markOutcomeHandled, forgetEarlierOutcomes } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));
    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(forgetEarlierOutcomes).toHaveBeenCalledWith("lease_create", "555");
    expect(forgetEarlierOutcomes.mock.invocationCallOrder[0]).toBeLessThan(createLease.mutate.mock.invocationCallOrder[0]);
    expect(markOutcomeHandled).not.toHaveBeenCalledWith("lease_create", "555", expect.anything());
  });

  it("stops with an actionable error rather than leasing a secret reference nothing holds a value for", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() =>
      result.current.actions.deploy("sdl", {
        secrets: {},
        unresolvedSecrets: [{ serviceTitle: "web", label: "API_KEY", name: "API_KEY", isKeptReference: false }]
      })
    );

    expect(result.current.deployError?.message).toBe('Secret "API_KEY" in service "web" needs a value.');
    expect(result.current.phase).toBe("quoting");
    expect(createLease.mutate).not.toHaveBeenCalled();
  });

  it("leases a kept secret reference the api may already hold rather than demanding it be typed again", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() =>
      result.current.actions.deploy("sdl", {
        secrets: {},
        unresolvedSecrets: [{ serviceTitle: "web", label: "DB_URL", name: "DB_URL", isKeptReference: true }]
      })
    );

    expect(result.current.deployError).toBeUndefined();
    expect(createLease.mutate).toHaveBeenCalled();
  });

  it("retry re-fires the same lease request after a failure", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));
    act(() => result.current.actions.deploy("sdl"));

    expect(createLease.mutate).toHaveBeenCalledTimes(2);
  });

  it("clears a prior deploy error when a new provider is selected", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
    const createLease = mockMutation();
    createLease.mutate.mockImplementation((_i, o) => o.onError(new Error("boom")));
    const { result } = renderFlow({ createDeployment, createLease });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));
    expect(result.current.deployError).toBeDefined();

    act(() => result.current.actions.selectProvider("placement-1", "akash1b/555/1/3"));
    expect(result.current.deployError).toBeUndefined();
  });

  it("clears selections the moment cancel starts, so a re-quote cannot reuse stale bids", () => {
    const closeDeployment = mockMutation();
    const { result } = renderFlow({ closeDeployment, intent: { dseq: "555" } });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });

    act(() => result.current.actions.cancelAndEdit());

    expect(result.current.phase).toBe("configuring");
    expect(result.current.selections).toEqual({});
  });

  it("leases without updating when the manifest is unchanged since create", async () => {
    const createDeployment = mockMutation();
    createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } }));
    const updateDeployment = mockMutation();
    const createLease = mockMutation();
    const { result } = renderFlow({ createDeployment, updateDeployment, createLease, manifestFromSdl: () => "M1" });

    act(() => result.current.actions.requestQuotes("sdl"));

    await settleSeal();
    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
    act(() => result.current.actions.deploy("sdl"));

    expect(updateDeployment.mutate).not.toHaveBeenCalled();
    expect(createLease.mutate).toHaveBeenCalledWith(
      { async: "true", manifest: "M1", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
      expect.anything()
    );
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

  it("keeps a selection whose bid has gone active, which is this deployment's own lease", async () => {
    const { result } = renderFlow({
      intent: { dseq: "555" },
      listBids: [{ bid: { state: "active", price: { amount: "1", denom: "uakt" }, id: { provider: "akash1a", dseq: "555", gseq: 1, oseq: 3 } } }]
    });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

    await waitFor(() => expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" }));
  });

  describe("abandoning an attempt", () => {
    it("closes the deployment and halts in error", async () => {
      const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate });

      act(() => result.current.actions.closeAndFail("no match"));

      await waitFor(() => expect(result.current.dseq).toBeNull());
      expect(result.current.phase).toBe("error");
      expect(result.current.error).toEqual({ message: "no match", kind: "no-match" });
      expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it("ends on the kind of abandonment the caller names", () => {
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate: vi.fn() });

      act(() => result.current.actions.closeAndFail("No providers", "no-providers"));

      expect(result.current.error).toEqual({ message: "No providers", kind: "no-providers" });
    });

    it("halts in error before the close resolves, so the caller stops driving immediately", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate });

      act(() => result.current.actions.closeAndFail("no match"));

      expect(result.current.phase).toBe("error");
      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: false });
    });

    it("hands the form back at once when a retry lands while the close is in flight, without a second close", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.phase).toBe("configuring");
      expect(result.current.dseq).toBeNull();

      act(() => closeMutate.mock.calls[0][1].onSuccess({ data: { success: true } }));

      expect(closeMutate).toHaveBeenCalledTimes(1);
      expect(result.current.pendingClose).toBeNull();
    });

    it("does not broadcast a second close while a failed close is still being verified", () => {
      const closeMutate = vi.fn((_args, { onError }) => onError(new Error("close failed")));
      const getDeploymentMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => result.current.actions.cancelAndEdit());

      expect(closeMutate).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe("configuring");
    });

    it("hands the form back once a failed close is verified gone, even when a retry landed mid-verification", () => {
      const closeMutate = vi.fn((_args, { onError }) => onError(new Error("close failed")));
      const getDeploymentMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => result.current.actions.cancelAndEdit());
      act(() => getDeploymentMutate.mock.calls[0][1].onSuccess({ data: { deployment: { state: "closed" } } }));

      expect(result.current.phase).toBe("configuring");
      expect(result.current.dseq).toBeNull();
    });

    it("keeps a deployment verified still open after a retry landed mid-verification, so the next cancel closes it", () => {
      const closeMutate = vi.fn((_args, { onError }) => onError(new Error("close failed")));
      const getDeploymentMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => result.current.actions.cancelAndEdit());
      act(() => getDeploymentMutate.mock.calls[0][1].onSuccess({ data: { deployment: { state: "active" } } }));

      expect(result.current.phase).toBe("configuring");
      expect(result.current.pendingClose).toMatchObject({ dseq: "777", failed: true });

      act(() => result.current.actions.cancelAndEdit());

      expect(closeMutate).toHaveBeenCalledTimes(2);
    });

    it("leaves a newer deployment's pending close alone when an older close settles late", async () => {
      const closeMutate = vi.fn();
      const createMutate = vi.fn((_args, options) => options.onSuccess({ data: { dseq: "888", manifest: "manifest" } }));
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => closeMutate.mock.calls[0][1].onSuccess({ data: { success: true } }));
      await settleSeal();
      expect(result.current.dseq).toBe("888");

      act(() => result.current.actions.closeAndFail("no match"));
      act(() => closeMutate.mock.calls[0][1].onSuccess({ data: { success: true } }));
      await settleSeal();

      expect(closeMutate).toHaveBeenCalledTimes(2);
      expect(result.current.pendingClose).toEqual({ dseq: "888", failed: false });
    });

    it("drops the dseq from the URL so a reload cannot resume the abandoned deployment", () => {
      const replace = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777", templateId: "tpl" }, replace, closeMutate: vi.fn() });

      act(() => result.current.actions.closeAndFail("no match"));

      expect(replace.mock.calls.at(-1)?.[0]).not.toContain("/configure/777");
    });

    it("halts in error without a close when the attempt never created a deployment", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto" }, closeMutate });

      act(() => result.current.actions.closeAndFail("no match"));

      expect(result.current.phase).toBe("error");
      expect(closeMutate).not.toHaveBeenCalled();
    });

    it("keeps the deployment for a later retry when its failed close is verified still open", () => {
      const closeMutate = vi.fn((_args, { onError }) => onError(new Error("close failed")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.closeAndFail("no match"));

      expect(result.current.phase).toBe("error");
      expect(result.current.error?.kind).toBe("no-match");
      expect(result.current.pendingClose).toMatchObject({ dseq: "777", failed: true });
    });

    it("clears the abandoned deployment when its failed close is verified already closed", () => {
      const closeMutate = vi.fn((_args, { onError }) => onError(new Error("close failed")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "closed" } } }));
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.closeAndFail("no match"));

      expect(result.current.phase).toBe("error");
      expect(result.current.error?.kind).toBe("no-match");
      expect(result.current.dseq).toBeNull();
    });

    it("returns to configuring on cancelAndEdit, so a retry starts from scratch", async () => {
      const closeMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { success: true } }));
      const { result } = setup({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: "777" }, closeMutate });

      act(() => result.current.actions.closeAndFail("no match"));
      await waitFor(() => expect(result.current.dseq).toBeNull());
      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
      expect(closeMutate).toHaveBeenCalledTimes(1);
    });
  });

  describe("deploy preconditions", () => {
    it("surfaces a retryable error when the manifest cannot be built from the sdl", () => {
      const createLease = mockMutation();
      const { result } = renderFlow({ intent: { dseq: "555" }, manifestFromSdl: () => null, createLease });

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.phase).toBe("quoting");
      expect(result.current.deployError?.message).toBeTruthy();
      expect(createLease.mutate).not.toHaveBeenCalled();
    });

    it("surfaces an error rather than doing nothing when no provider is selected", () => {
      const createLease = mockMutation();
      const { result } = renderFlow({ intent: { dseq: "555" }, createLease });

      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.phase).toBe("quoting");
      expect(result.current.deployError?.message).toBeTruthy();
      expect(createLease.mutate).not.toHaveBeenCalled();
    });
  });

  it("does not prune selections while no bids have loaded", () => {
    const { result } = renderFlow({ intent: { dseq: "555" }, listBids: [] });

    act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

    expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });
  });

  describe("sealing secrets", () => {
    it("keeps no copy of the created SDL in this browser, since the sealed create leaves the api's copy complete", async () => {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const { result, deploymentLocalStorage } = renderFlow({ createDeployment });

      act(() => result.current.actions.requestQuotes("SDL_AT_CREATE"));

      await waitFor(() => expect(createDeployment.mutate).toHaveBeenCalled());
      expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
    });

    it("keeps no copy of the deployed SDL in this browser once the lease is created", async () => {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      const { result, deploymentLocalStorage } = renderFlow({ createDeployment, createLease });

      act(() => result.current.actions.requestQuotes("SDL_CONTENT"));
      await waitFor(() => expect(createDeployment.mutate).toHaveBeenCalled());
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("SDL_CONTENT"));

      expect(createLease.mutate).toHaveBeenCalled();
      expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
    });

    it("seals the typed secrets to the fetched context and sends the seal with the create", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, sealSdlSecrets } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { secrets: { API_KEY: "hunter2" } }));

      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, sdl: "sdl-content", secrets: { API_KEY: "hunter2" } });
      expect(createMutate).toHaveBeenCalledWith(
        { async: "true", data: { sdl: "sdl-content", sealedSecrets: "SEALED", deposit: expect.any(Number) } },
        expect.any(Object)
      );
    });

    it("sends an empty seal when nothing is secret, which is what stops the api protecting every variable", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, sealSdlSecrets } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      expect(sealSdlSecrets).toHaveBeenCalledWith({ context: SEAL_CONTEXT, sdl: "sdl-content", secrets: {} });
      expect(createMutate.mock.calls[0][0].data).toHaveProperty("sealedSecrets", "SEALED");
    });

    it("counts the sealed secrets on the create_deployment event", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { secrets: { A: "1", B: "2" } }));

      await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("create_deployment", expect.objectContaining({ dseq: "999", secretCount: 2 })));
    });

    it("fetches a fresh context and seals again once when the api reports the sealing key stale", async () => {
      const createMutate = vi
        .fn()
        .mockImplementationOnce((_args, { onError }) => onError(new ApiError(409, { message: STALE_KEY_MESSAGE }, "POST /v1/deployments → 409")))
        .mockImplementationOnce((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, sealSdlSecrets, getSdlSecretsContext } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      expect(getSdlSecretsContext.mutateAsync).toHaveBeenCalledTimes(2);
      expect(sealSdlSecrets).toHaveBeenCalledTimes(2);
      expect(createMutate).toHaveBeenCalledTimes(2);
    });

    it("does not seal again when the conflict is a wallet still being provisioned, which the create mutation retries itself", async () => {
      const createMutate = vi.fn((_args, { onError }) =>
        onError(
          new ApiError(
            409,
            { message: "Wallet is still being provisioned, please retry shortly", code: "wallet_provisioning" },
            "POST /v1/deployments \u2192 409"
          )
        )
      );
      const { result, sealSdlSecrets } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(sealSdlSecrets).toHaveBeenCalledTimes(1);
      expect(result.current.error?.message).toContain("still being set up");
      expect(result.current.error?.kind).toBe("create");
    });

    it("does not seal again when the create fails with something other than a conflict", async () => {
      const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(500, { message: "Internal server error" }, "POST /v1/deployments \u2192 500")));
      const { result, sealSdlSecrets } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(sealSdlSecrets).toHaveBeenCalledTimes(1);
    });

    it("gives up after one new seal, so a conflict that persists surfaces as a create error", async () => {
      const createMutate = vi.fn((_args, { onError }) => onError(new ApiError(409, { message: STALE_KEY_MESSAGE }, "POST /v1/deployments → 409")));
      const { result } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(result.current.error).toEqual({ kind: "create", message: STALE_KEY_MESSAGE });
      expect(createMutate).toHaveBeenCalledTimes(2);
    });

    it("surfaces a create error and creates nothing when the sealing context cannot be fetched", async () => {
      const sealContextMutateAsync = vi.fn(async () => {
        throw new ApiError(503, { message: "Service temporarily unavailable" }, "GET /v1/sdl-secrets-context → 503");
      });
      const createMutate = vi.fn();
      const { result } = setup({ createMutate, sealContextMutateAsync });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(result.current.error).toEqual({ kind: "create", message: "Service temporarily unavailable" });
      expect(createMutate).not.toHaveBeenCalled();
    });

    it("drops a create whose attempt was cancelled while its secrets were still being sealed", async () => {
      let finishSealing: (seal: string) => void = () => undefined;
      const sealSdlSecrets = () =>
        new Promise<string>(resolve => {
          finishSealing = resolve;
        });
      const createMutate = vi.fn();
      const { result } = setup({ createMutate, sealSdlSecrets });

      act(() => result.current.actions.requestQuotes("sdl-content"));
      act(() => result.current.actions.cancelAndEdit());
      await act(async () => finishSealing("SEALED"));

      expect(createMutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("configuring");
    });

    it("names the deployment to inherit secrets from on the create", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { inheritSecretsFrom: "123" }));

      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      expect(createMutate.mock.calls[0][0].data).toHaveProperty("inheritSecretsFrom", "123");
    });

    it("surfaces an unreadable source as its own error without sealing again, since no retry can help", async () => {
      const message = "The secrets recorded for the deployment being inherited from can no longer be decrypted";
      const createMutate = vi.fn((_args, { onError }) =>
        onError(new ApiError(409, { message, code: "inherited_secrets_unreadable" }, "POST /v1/deployments → 409"))
      );
      const { result, sealSdlSecrets } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { inheritSecretsFrom: "123" }));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(result.current.error).toEqual({ kind: "inherited-unreadable", message });
      expect(sealSdlSecrets).toHaveBeenCalledTimes(1);
      expect(createMutate).toHaveBeenCalledTimes(1);
    });
  });

  describe("quoting-window edits", () => {
    it("patches what changed since the create instead of resubmitting the whole SDL, then leases", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const updateDeployment = mockMutation();
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const createLease = mockMutation();
      const servicesPatchBetween = vi.fn(() => ({ web: { env: { FOO: "bar" } } }));
      const { result } = renderFlow({
        createDeployment,
        updateDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() =>
        expect(createLease.mutate).toHaveBeenCalledWith(
          { async: "true", manifest: "M2", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] },
          expect.anything()
        )
      );
      expect(servicesPatchBetween).toHaveBeenCalledWith("sdl-a", "sdl-b");
      expect(patchDeployment.mutate).toHaveBeenCalledWith(
        { dseq: "555", data: { services: { web: { env: { FOO: "bar" } } }, sealedSecrets: "SEALED" } },
        expect.anything()
      );
      expect(updateDeployment.mutate).not.toHaveBeenCalled();
    });

    it.each([
      { outcome: "succeeded", settle: (o: LeaseCallbacks) => o.onSuccess({}), error: null },
      { outcome: "failed", settle: (o: LeaseCallbacks) => o.onError(new Error("boom")), error: new Error("boom") }
    ])("marks the update it sent on the way to the lease as handled once the patch has $outcome", async ({ outcome, settle, error }) => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(
        vi.fn((_i, o: LeaseCallbacks) => {
          settle(o);
          o.onSettled(undefined, error);
        })
      );
      const { result, markOutcomeHandled, forgetEarlierOutcomes } = renderFlow({
        createDeployment,
        patchDeployment,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({ web: { env: { FOO: "bar" } } })
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(markOutcomeHandled).toHaveBeenCalledWith("deployment_update", "555", outcome));
      expect(forgetEarlierOutcomes).toHaveBeenCalledWith("deployment_update", "555");
      expect(forgetEarlierOutcomes.mock.invocationCallOrder[0]).toBeLessThan(patchDeployment.mutate.mock.invocationCallOrder[0]);
    });

    it("seals an empty set beside an edit that types no secret, so the api keeps the plain variables it writes readable", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const { result, sealSdlSecrets } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease: mockMutation(),
        manifestFromSdl: () => "M2",
        servicesPatchBetween: vi.fn(() => ({ web: { env: { FOO: "bar" } } }))
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(patchDeployment.mutate).toHaveBeenCalled());
      expect(sealSdlSecrets).toHaveBeenLastCalledWith({ context: SEAL_CONTEXT, secrets: {} });
    });

    it("seals the typed secret values into the patch without binding them to an SDL", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const createLease = mockMutation();
      const { result, sealSdlSecrets } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({})
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b", { secrets: { API_KEY: "x" } }));

      await waitFor(() => expect(patchDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", data: { sealedSecrets: "SEALED" } }, expect.anything()));
      expect(patchDeployment.mutate.mock.calls[0][0].data).not.toHaveProperty("services");
      expect(sealSdlSecrets).toHaveBeenLastCalledWith({ context: SEAL_CONTEXT, secrets: { API_KEY: "x" } });
      expect(createLease.mutate).toHaveBeenCalled();
    });

    it("patches a corrected secret value even though its reference leaves the manifest unchanged", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const createLease = mockMutation();
      const { result, sealSdlSecrets } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M1",
        servicesPatchBetween: () => ({})
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-a", { secrets: { API_KEY: "corrected" } }));

      await waitFor(() => expect(patchDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", data: { sealedSecrets: "SEALED" } }, expect.anything()));
      expect(sealSdlSecrets).toHaveBeenLastCalledWith({ context: SEAL_CONTEXT, secrets: { API_KEY: "corrected" } });
      expect(createLease.mutate).toHaveBeenCalled();
    });

    it("fetches a fresh context and seals again once when the api reports the sealing key stale on a patch", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(
        vi
          .fn()
          .mockImplementationOnce((_i, o) => o.onError(new ApiError(409, { message: STALE_KEY_MESSAGE }, "PATCH /v1/deployments/555 \u2192 409")))
          .mockImplementationOnce((_i, o) => o.onSuccess({}))
      );
      const createLease = mockMutation();
      const { result, sealSdlSecrets, getSdlSecretsContext } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({ web: { image: "nginx:2" } })
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      const sealsBeforeDeploy = sealSdlSecrets.mock.calls.length;
      const contextFetchesBeforeDeploy = getSdlSecretsContext.mutateAsync.mock.calls.length;
      act(() => result.current.actions.deploy("sdl-b", { secrets: { API_KEY: "x" } }));

      await waitFor(() => expect(createLease.mutate).toHaveBeenCalled());
      expect(patchDeployment.mutate).toHaveBeenCalledTimes(2);
      expect(sealSdlSecrets.mock.calls.length - sealsBeforeDeploy).toBe(2);
      expect(getSdlSecretsContext.mutateAsync.mock.calls.length - contextFetchesBeforeDeploy).toBe(2);
    });

    it("gives up after one new seal, so a patch conflict that persists surfaces as a deploy error", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(
        vi.fn((_i, o) => o.onError(new ApiError(409, { message: STALE_KEY_MESSAGE }, "PATCH /v1/deployments/555 \u2192 409")))
      );
      const createLease = mockMutation();
      const { result } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({ web: { image: "nginx:2" } })
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b", { secrets: { API_KEY: "x" } }));

      await waitFor(() => expect(result.current.deployError).toEqual({ message: STALE_KEY_MESSAGE, canLeaseElsewhere: false }));
      expect(patchDeployment.mutate).toHaveBeenCalledTimes(2);
      expect(createLease.mutate).not.toHaveBeenCalled();
    });

    it("leases without any update when nothing patchable changed and no secret was typed", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const updateDeployment = mockMutation();
      const patchDeployment = mockMutation();
      const createLease = mockMutation();
      const { result } = renderFlow({
        createDeployment,
        updateDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({})
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(createLease.mutate).toHaveBeenCalled());
      expect(patchDeployment.mutate).not.toHaveBeenCalled();
      expect(updateDeployment.mutate).not.toHaveBeenCalled();
    });

    it("diffs against the stored definition when resuming a session that never saw the create", async () => {
      const getDeployment = mockMutation(
        vi.fn(),
        vi.fn(async () => ({ data: { consoleSettings: { sdl: "stored-sdl" } } }))
      );
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const createLease = mockMutation();
      const servicesPatchBetween = vi.fn(() => ({ web: { image: "nginx:2" } }));
      const { result } = renderFlow({ intent: { dseq: "555" }, getDeployment, patchDeployment, createLease, servicesPatchBetween });

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("SDL_CONTENT"));

      await waitFor(() =>
        expect(patchDeployment.mutate).toHaveBeenCalledWith(
          { dseq: "555", data: { services: { web: { image: "nginx:2" } }, sealedSecrets: "SEALED" } },
          expect.anything()
        )
      );
      expect(getDeployment.mutateAsync).toHaveBeenCalledWith({ dseq: "555" });
      expect(servicesPatchBetween).toHaveBeenCalledWith("stored-sdl", "SDL_CONTENT");
      expect(createLease.mutate).toHaveBeenCalled();
    });

    it("falls back to resubmitting the whole SDL when no definition is stored to diff against", async () => {
      const getDeployment = mockMutation(
        vi.fn(),
        vi.fn(async () => ({ data: { consoleSettings: null } }))
      );
      const updateDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const patchDeployment = mockMutation();
      const createLease = mockMutation();
      const { result } = renderFlow({ intent: { dseq: "555" }, getDeployment, updateDeployment, patchDeployment, createLease });

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("SDL_CONTENT"));

      await waitFor(() => expect(updateDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", data: { sdl: "SDL_CONTENT" } }, expect.anything()));
      expect(patchDeployment.mutate).not.toHaveBeenCalled();
      expect(createLease.mutate).toHaveBeenCalled();
    });

    it("returns to quoting with a retryable error when the patch fails", async () => {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M1" } })));
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onError(new ApiError(400, { message: "Invalid SDL" }, "PATCH → 400"))));
      const createLease = mockMutation();
      const { result } = renderFlow({
        createDeployment,
        patchDeployment,
        createLease,
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({ web: { image: "x" } })
      });

      act(() => result.current.actions.requestQuotes("sdl-a"));
      await waitFor(() => expect(result.current.phase).toBe("quoting"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(result.current.deployError).toEqual({ message: "Invalid SDL", canLeaseElsewhere: false }));
      expect(result.current.phase).toBe("quoting");
      expect(createLease.mutate).not.toHaveBeenCalled();
    });
  });

  describe("when a resumed SDL keeps references the api holds the values for", () => {
    it("leases without any update and leaves the manifest to the api when the stored definition is deployed unchanged", async () => {
      const getDeployment = mockMutation(
        vi.fn(),
        vi.fn(async () => ({ data: { consoleSettings: { sdl: REFERENCED_SDL } } }))
      );
      const updateDeployment = mockMutation();
      const patchDeployment = mockMutation();
      const createLease = mockMutation();
      const { result } = renderFlow({ intent: { dseq: "555" }, getDeployment, updateDeployment, patchDeployment, createLease });

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy(REFERENCED_SDL));

      await waitFor(() =>
        expect(createLease.mutate).toHaveBeenCalledWith({ async: "true", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] }, expect.anything())
      );
      expect(createLease.mutate.mock.calls[0][0]).not.toHaveProperty("manifest");
      expect(updateDeployment.mutate).not.toHaveBeenCalled();
      expect(patchDeployment.mutate).not.toHaveBeenCalled();
    });

    it("patches an edit instead of resubmitting a whole SDL whose references it could not resolve", async () => {
      const getDeployment = mockMutation(
        vi.fn(),
        vi.fn(async () => ({ data: { consoleSettings: { sdl: REFERENCED_SDL } } }))
      );
      const updateDeployment = mockMutation();
      const patchDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({})));
      const createLease = mockMutation();
      const servicesPatchBetween = vi.fn(() => ({ web: { image: "nginx:2" } }));
      const { result } = renderFlow({ intent: { dseq: "555" }, getDeployment, updateDeployment, patchDeployment, createLease, servicesPatchBetween });

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy(REFERENCED_SDL));

      await waitFor(() =>
        expect(patchDeployment.mutate).toHaveBeenCalledWith(
          { dseq: "555", data: { services: { web: { image: "nginx:2" } }, sealedSecrets: "SEALED" } },
          expect.anything()
        )
      );
      expect(servicesPatchBetween).toHaveBeenCalledWith(REFERENCED_SDL, REFERENCED_SDL);
      expect(updateDeployment.mutate).not.toHaveBeenCalled();
      expect(createLease.mutate).toHaveBeenCalledWith({ async: "true", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] }, expect.anything());
    });
  });

  describe("deploying in the background", () => {
    const LEASE = { dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" };

    it("asks the api to finish the lease in the background", async () => {
      const createLease = mockMutation();
      const { result } = await renderQuotingFlow({ createLease });

      act(() => result.current.actions.deploy("sdl"));
      expect(createLease.mutate).toHaveBeenCalledWith({ manifest: "M", leases: [LEASE], async: "true" }, expect.anything());
      expect(result.current.phase).toBe("deploying");
      expect(result.current.isDeployedInBackground).toBe(false);
    });

    it("asks the api to finish an auto deploy's lease in the background too, without its progress screen", async () => {
      const createLease = mockMutation();
      const { result } = await renderQuotingFlow({ createLease });

      act(() => result.current.actions.deploy("sdl", { isAutoDeploy: true }));

      expect(createLease.mutate).toHaveBeenCalledWith({ manifest: "M", leases: [LEASE], async: "true" }, expect.anything());
      expect(result.current.showsDeployProgress).toBe(false);
    });

    it("shows no progress screen while the api may still take the lease on, and shows it once the request has run longer than a hand-off takes", async () => {
      vi.useFakeTimers();
      try {
        const lease = deferredMutate();
        const { result } = await renderQuotingFlow({ createLease: mockMutation(lease.mutate) });

        expect(result.current.showsDeployProgress).toBe(false);

        act(() => result.current.actions.deploy("sdl"));
        act(() => vi.advanceTimersByTime(2_999));

        expect(result.current.phase).toBe("deploying");
        expect(result.current.showsDeployProgress).toBe(false);

        act(() => vi.advanceTimersByTime(1));

        expect(result.current.showsDeployProgress).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("hides the progress screen again when the next deploy may finish in the background", async () => {
      vi.useFakeTimers();
      try {
        const lease = deferredMutate();
        const { result } = await renderQuotingFlow({ createLease: mockMutation(lease.mutate) });

        act(() => result.current.actions.deploy("sdl"));
        act(() => vi.advanceTimersByTime(3_000));
        act(() => lease.calls[0].options.onError?.(new Error("bid closed")));
        act(() => result.current.actions.deploy("sdl"));

        expect(result.current.showsDeployProgress).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([
      { case: "takes the lease on in the background", answer: { data: { activityId: "activity-1" } } },
      { case: "creates the lease during the request", answer: deployedResult("akash1owner") }
    ])("never shows the progress screen when the api soon answers that it $case", async ({ answer }) => {
      vi.useFakeTimers();
      try {
        const lease = deferredMutate();
        const { result } = await renderQuotingFlow({ createLease: mockMutation(lease.mutate) });

        act(() => result.current.actions.deploy("sdl"));
        act(() => vi.advanceTimersByTime(500));
        await act(async () => lease.calls[0].options.onSuccess?.(answer));
        act(() => vi.advanceTimersByTime(3_000));

        expect(result.current.deploySucceeded).toBe(true);
        expect(result.current.showsDeployProgress).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("leaves no progress screen to appear later once the api refuses the lease", async () => {
      vi.useFakeTimers();
      try {
        const lease = deferredMutate();
        const { result } = await renderQuotingFlow({ createLease: mockMutation(lease.mutate) });

        act(() => result.current.actions.deploy("sdl"));
        act(() => vi.advanceTimersByTime(1_000));
        act(() => lease.calls[0].options.onError?.(new ApiError(400, { message: "The bid is closed" }, "POST /v1/leases → 400")));
        act(() => vi.advanceTimersByTime(3_000));

        expect(result.current.phase).toBe("quoting");
        expect(result.current.deployError).toEqual({ message: "The bid is closed", canLeaseElsewhere: true });
        expect(result.current.showsDeployProgress).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows no progress screen while an edit since quoting is applied, and starts the wait only once the lease is requested", async () => {
      vi.useFakeTimers();
      try {
        const patch = deferredMutate();
        const lease = deferredMutate();
        const { result } = await renderQuotingFlow({
          createLease: mockMutation(lease.mutate),
          patchDeployment: mockMutation(patch.mutate),
          manifestFromSdl: () => "M2",
          servicesPatchBetween: () => ({ web: { env: { FOO: "bar" } } })
        });

        act(() => result.current.actions.deploy("sdl-b"));
        await act(async () => {});
        act(() => vi.advanceTimersByTime(5_000));

        expect(patch.calls).toHaveLength(1);
        expect(result.current.showsDeployProgress).toBe(false);

        await act(async () => patch.calls[0].options.onSuccess?.({}));
        act(() => vi.advanceTimersByTime(2_999));

        expect(lease.calls).toHaveLength(1);
        expect(result.current.showsDeployProgress).toBe(false);

        act(() => vi.advanceTimersByTime(1));

        expect(result.current.showsDeployProgress).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("sends the user to the deployments list as soon as the api takes the lease on, without waiting to show the deployment", async () => {
      vi.useFakeTimers();
      try {
        const { result, router } = await renderQuotingFlow({ createLease: acceptedLease() });

        await act(async () => result.current.actions.deploy("sdl"));
        act(() => vi.runAllTimers());

        expect(router.replace).toHaveBeenLastCalledWith(UrlService.deploymentList());
        expect(router.replace).not.toHaveBeenCalledWith(UrlService.deploymentDetails("555", "EVENTS", "events"));
        expect(result.current.deploySucceeded).toBe(true);
        expect(result.current.isDeployedInBackground).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("waits for the feed to show the lease underway before sending the user to the list, so the deployment reads as spinning up there", async () => {
      let refreshFeed = () => {};
      const { result, router, queryClient } = await renderQuotingFlow({ createLease: acceptedLease() });
      queryClient.invalidateQueries.mockImplementation(async filters => {
        if (filters?.queryKey?.[1] === "listActivities") await new Promise<void>(resolve => (refreshFeed = resolve));
      });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(result.current.deploySucceeded).toBe(true);
      expect(router.replace).not.toHaveBeenCalledWith(UrlService.deploymentList());

      await act(async () => refreshFeed());

      expect(router.replace).toHaveBeenLastCalledWith(UrlService.deploymentList());
    });

    it("leaves telling how a lease the api took on ends to the activity host, so it marks and follows nothing", async () => {
      const createLease = acceptedLease();
      const { result, markOutcomeHandled, forgetEarlierOutcomes, followUntilSettled } = await renderQuotingFlow({ createLease });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(forgetEarlierOutcomes).toHaveBeenCalledWith("lease_create", "555");
      expect(forgetEarlierOutcomes.mock.invocationCallOrder[0]).toBeLessThan(createLease.mutate.mock.invocationCallOrder[0]);
      expect(markOutcomeHandled).not.toHaveBeenCalledWith("lease_create", expect.anything(), expect.anything());
      expect(followUntilSettled).not.toHaveBeenCalled();
    });

    it("holds the deploy analytics for the lease's activity instead of tracking them when the api takes it on", async () => {
      const resources = { gpuAmount: 1, cpuAmount: 4, memoryAmount: 2048, storageAmount: 4096 };
      const { result, holdActivityEvents, analyticsService } = await renderQuotingFlow({
        createLease: acceptedLease(),
        deploymentResourcesFromSdl: () => resources
      });

      await act(async () => result.current.actions.deploy("sdl"));

      const leaseProperties = { category: "deployments", label: "Create lease", dseq: "555", ...resources };
      expect(holdActivityEvents).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({
          succeeded: [
            { event: "create_lease", properties: leaseProperties },
            { event: "create_gpu_deployment", properties: leaseProperties },
            { event: "send_manifest", properties: { category: "deployments", label: "Send manifest after creating lease", dseq: "555" } }
          ]
        })
      );
      expect(analyticsService.track).not.toHaveBeenCalledWith("create_lease", expect.anything());
      expect(analyticsService.track).not.toHaveBeenCalledWith("send_manifest", expect.anything());
    });

    it("holds no gpu deploy event for a deployment without a GPU", async () => {
      const { result, holdActivityEvents } = await renderQuotingFlow({ createLease: acceptedLease() });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(holdActivityEvents).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ succeeded: [expect.objectContaining({ event: "create_lease" }), expect.objectContaining({ event: "send_manifest" })] })
      );
    });

    it("holds a deploy_failed event for the lease's activity, so a lease that fails in the background is still reported", async () => {
      const { result, holdActivityEvents, analyticsService } = await renderQuotingFlow({ createLease: acceptedLease() });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(holdActivityEvents).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({
          failed: [
            {
              event: "deploy_failed",
              properties: { category: "deployments", stage: "background_lease", dseq: "555", isAutoDeploy: false, inBackground: true }
            }
          ]
        })
      );
      expect(analyticsService.track).not.toHaveBeenCalledWith("deploy_failed", expect.anything());
    });

    it("tells the onboarding gate to expect the lease and refreshes the feed and the list the user lands on", async () => {
      const { result, queryClient } = await renderQuotingFlow({ createLease: acceptedLease() });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(queryClient.setQueryData).toHaveBeenCalledWith(QueryKeys.getLeaseExistenceKey("akash1owner"), true);
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listDeployments"] });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getDeploymentListKey("akash1owner") });
    });

    it("leaves the wallet's caches alone while the wallet is not known yet", async () => {
      const { result, queryClient, router } = await renderQuotingFlow({ createLease: acceptedLease(), settingsId: null });

      await act(async () => result.current.actions.deploy("sdl"));

      expect(queryClient.setQueryData).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: expect.arrayContaining(["DEPLOYMENT_LIST"]) });
      expect(router.replace).toHaveBeenLastCalledWith(UrlService.deploymentList());
    });

    it("finishes the deploy at once when the api answers 200 and creates the lease during the request", async () => {
      vi.useFakeTimers();
      try {
        const createLease = mockMutation(vi.fn((_i, o) => o.onSuccess(deployedResult("akash1owner"))));
        const { result, router, analyticsService, holdActivityEvents, markOutcomeHandled } = await renderQuotingFlow({ createLease });

        act(() => result.current.actions.deploy("sdl"));

        expect(result.current.deploySucceeded).toBe(true);
        expect(result.current.isDeployedInBackground).toBe(false);
        expect(analyticsService.track).toHaveBeenCalledWith("create_lease", expect.objectContaining({ dseq: "555" }));
        expect(holdActivityEvents).not.toHaveBeenCalled();
        expect(markOutcomeHandled).toHaveBeenCalledWith("lease_create", "555", "succeeded");

        act(() => vi.runAllTimers());
        expect(router.replace).toHaveBeenLastCalledWith(UrlService.deploymentDetails("555", "EVENTS", "events"));
      } finally {
        vi.useRealTimers();
      }
    });

    it("stays on the provider step with the api's reason when other bids of the deployment are already being leased", async () => {
      const conflict = new ApiError(409, { message: "A lease is already being created for this deployment" }, "POST /v1/leases → 409");
      const createLease = mockMutation(vi.fn((_i, o) => o.onError(conflict)));
      const { result, router, holdActivityEvents, markOutcomeHandled } = await renderQuotingFlow({ createLease });

      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.phase).toBe("quoting");
      expect(result.current.deployError).toEqual({ message: "A lease is already being created for this deployment", canLeaseElsewhere: false });
      expect(router.replace).not.toHaveBeenCalledWith(UrlService.deploymentList());
      expect(holdActivityEvents).not.toHaveBeenCalled();
      expect(markOutcomeHandled).toHaveBeenCalledWith("lease_create", "555", "failed");
    });

    it("finishes the update before the lease, and sends the user away only once the api has taken the lease on", async () => {
      const patch = deferredMutate();
      const createLease = acceptedLease();
      const { result, router } = await renderQuotingFlow({
        createLease,
        patchDeployment: mockMutation(patch.mutate),
        manifestFromSdl: () => "M2",
        servicesPatchBetween: () => ({ web: { env: { FOO: "bar" } } })
      });

      act(() => result.current.actions.deploy("sdl-b"));
      await waitFor(() => expect(patch.calls).toHaveLength(1));

      expect(createLease.mutate).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalledWith(UrlService.deploymentList());

      await act(async () => patch.calls[0].options.onSuccess?.({}));

      expect(createLease.mutate).toHaveBeenCalledWith({ manifest: "M2", leases: [LEASE], async: "true" }, expect.anything());
      expect(router.replace).toHaveBeenLastCalledWith(UrlService.deploymentList());
    });

    function acceptedLease() {
      return mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { activityId: "activity-1" } })));
    }

    async function renderQuotingFlow(input: NonNullable<Parameters<typeof renderFlow>[0]>) {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } })));
      const flow = renderFlow({ createDeployment, ...input });
      act(() => flow.result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => flow.result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      return flow;
    }
  });

  describe("deploy funnel analytics", () => {
    it("tracks create_deployment with the new dseq when the deployment is created", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await settleSeal();

      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment", {
        category: "deployments",
        label: "Create deployment in wizard",
        dseq: "999",
        secretCount: 0
      });
    });

    it.each([
      { cause: new ApiError(400, { message: "Invalid SDL: too big" }, "POST /v1/deployments → 400"), event: { kind: "create", status: 400 } },
      {
        cause: new ApiError(402, { message: "Add funds", code: "payment_required" }, "POST /v1/deployments → 402"),
        event: { kind: "needs-funds", status: 402 }
      },
      { cause: new Error("network down"), event: { kind: "create" } }
    ])("tracks create_deployment_failed with the refusal's kind and status ($event.kind, $event.status)", async ({ cause, event }) => {
      const createMutate = vi.fn((_args, { onError }) => onError(cause));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment_failed", { category: "deployments", ...event });
    });

    it("tracks create_deployment_failed when the source a redeploy inherits secrets from can't be read", async () => {
      const refusal = new ApiError(409, { message: "unreadable", code: "inherited_secrets_unreadable" }, "POST /v1/deployments → 409");
      const createMutate = vi.fn((_args, { onError }) => onError(refusal));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { inheritSecretsFrom: "123" }));

      await waitFor(() => expect(result.current.phase).toBe("error"));
      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment_failed", { category: "deployments", kind: "inherited-unreadable", status: 409 });
    });

    it("does not track create_deployment_failed when the deployment is created", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content"));
      await settleSeal();

      expect(analyticsService.track).not.toHaveBeenCalledWith("create_deployment_failed", expect.anything());
    });

    it("tracks create_deployment with how many screened providers were not bidding when bids were requested", async () => {
      const createMutate = vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } }));
      const { result, analyticsService } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl-content", { screening: { placementCount: 1, providerCount: 4, notBiddingProviderCount: 4 } }));

      await settleSeal();

      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment", expect.objectContaining({ dseq: "999", notBiddingProviderCount: 4 }));
    });

    it("tracks bids_received with how many screened providers were not bidding when bids were requested", async () => {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "999", gseq: 1, oseq: 1 } } };
      const createDeployment = mockMutation(vi.fn((_args, { onSuccess }) => onSuccess({ data: { dseq: "999", manifest: "m" } })));
      const { result, analyticsService } = renderFlow({ createDeployment, listBids: [openBid] });

      act(() => result.current.actions.requestQuotes("sdl-content", { screening: { placementCount: 1, providerCount: 4, notBiddingProviderCount: 2 } }));
      await settleSeal();

      expect(analyticsService.track).toHaveBeenCalledWith("bids_received", expect.objectContaining({ numberOfBids: 1, notBiddingProviderCount: 2 }));
    });

    it("tracks bids_received with the bid count the first time bids arrive", () => {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      const { analyticsService } = renderFlow({ intent: { dseq: "777" }, listBids: [openBid] });

      expect(analyticsService.track).toHaveBeenCalledWith("bids_received", { category: "deployments", numberOfBids: 1, dseq: "777" });
    });

    it("fires bids_received only once across subsequent bid refetches", () => {
      const openBid = { bid: { state: "open", price: { amount: "1", denom: "uakt" }, id: { provider: "p", dseq: "777", gseq: 1, oseq: 1 } } };
      const { rerender, analyticsService } = renderFlow({ intent: { dseq: "777" }, listBids: [openBid] });

      rerender();
      rerender();

      expect(analyticsService.track.mock.calls.filter(([name]) => name === "bids_received")).toHaveLength(1);
    });

    it("tracks bid_selected when a provider is selected", () => {
      const { result, analyticsService } = renderFlow();

      act(() => result.current.actions.selectProvider("placement-1", "akash1a/1/1/1"));

      expect(analyticsService.track).toHaveBeenCalledWith("bid_selected", "Amplitude");
    });

    it("tracks create_lease and send_manifest with the deployment resources on lease success", async () => {
      const { result, analyticsService } = renderDeployedFlow({ gpuAmount: 0, cpuAmount: 2, memoryAmount: 1024, storageAmount: 2048 });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("create_lease", {
        category: "deployments",
        label: "Create lease",
        dseq: "555",
        gpuAmount: 0,
        cpuAmount: 2,
        memoryAmount: 1024,
        storageAmount: 2048
      });
      expect(analyticsService.track).toHaveBeenCalledWith("send_manifest", {
        category: "deployments",
        label: "Send manifest after creating lease",
        dseq: "555"
      });
    });

    it("tracks create_gpu_deployment on lease success when the deployment requests a GPU", async () => {
      const { result, analyticsService } = renderDeployedFlow({ gpuAmount: 1, cpuAmount: 4, memoryAmount: 2048, storageAmount: 4096 });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("create_gpu_deployment", {
        category: "deployments",
        label: "Create lease",
        dseq: "555",
        gpuAmount: 1,
        cpuAmount: 4,
        memoryAmount: 2048,
        storageAmount: 4096
      });
    });

    it("does not track create_gpu_deployment for a CPU-only deployment", () => {
      const { result, analyticsService } = renderDeployedFlow({ gpuAmount: 0, cpuAmount: 2, memoryAmount: 1024, storageAmount: 2048 });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).not.toHaveBeenCalledWith("create_gpu_deployment", expect.anything());
    });

    function renderDeployedFlow(resources: { gpuAmount: number; cpuAmount: number; memoryAmount: number; storageAmount: number }) {
      const createDeployment = mockMutation();
      createDeployment.mutate.mockImplementation((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } }));
      const createLease = mockMutation();
      createLease.mutate.mockImplementation((_i, o) => o.onSuccess(deployedResult("akash1owner")));
      return renderFlow({ createDeployment, createLease, deploymentResourcesFromSdl: () => resources });
    }
  });

  describe("deploy failure analytics", () => {
    const FAILED_DEPLOY = { category: "deployments", dseq: "555", isAutoDeploy: false, inBackground: true };

    it("tracks deploy_failed at the manifest_build stage when the manifest cannot be built", () => {
      const { result, analyticsService } = renderFlow({ intent: { dseq: "555" }, manifestFromSdl: () => null });
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "manifest_build" });
    });

    it("tracks deploy_failed at the no_selection stage when no provider is selected", () => {
      const { result, analyticsService } = renderFlow({ intent: { dseq: "555" } });

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "no_selection" });
    });

    it("tracks deploy_failed at the unresolved_secret stage without naming the secret", () => {
      const { result, analyticsService } = renderFlow({ intent: { dseq: "555" } });
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

      act(() =>
        result.current.actions.deploy("sdl", { unresolvedSecrets: [{ serviceTitle: "web", label: "API_KEY", name: "API_KEY", isKeptReference: false }] })
      );

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "unresolved_secret" });
    });

    it("tracks deploy_failed at the seal stage when the secrets of an edit cannot be sealed", async () => {
      const { result, analyticsService } = renderResumedFlow({
        sealSdlSecrets: async () => {
          throw new Error("sealing failed");
        }
      });

      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "seal", errorKind: "unknown" }));
    });

    it("tracks deploy_failed at the patch stage with the api's code and status but not its message when the patch is refused", async () => {
      const refusal = new ApiError(400, { code: "invalid_sdl", message: "Invalid SDL" }, "PATCH /v1/deployments/555 → 400");
      const { result, analyticsService } = renderResumedFlow({ patchDeployment: mockMutation(vi.fn((_i, o) => o.onError(refusal))) });

      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() =>
        expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", {
          ...FAILED_DEPLOY,
          stage: "patch",
          errorCode: "invalid_sdl",
          errorStatus: 400,
          errorKind: "chain_error"
        })
      );
    });

    it("tracks deploy_failed at the patch stage when the stored definition to diff against cannot be read", async () => {
      const { result, analyticsService } = renderResumedFlow({ getDeployment: mockMutation(vi.fn(), vi.fn().mockRejectedValue(new Error("unreachable"))) });

      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "patch", errorKind: "unknown" }));
    });

    it("tracks deploy_failed at the update stage with the api's status when the whole SDL cannot be resubmitted", async () => {
      const { result, analyticsService } = renderResumedFlow({
        getDeployment: mockMutation(
          vi.fn(),
          vi.fn(async () => ({ data: { consoleSettings: null } }))
        ),
        updateDeployment: mockMutation(vi.fn((_i, o) => o.onError(new ApiError(400, { message: "Invalid SDL" }, "PUT → 400"))))
      });

      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() =>
        expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "update", errorStatus: 400, errorKind: "chain_error" })
      );
    });

    it("tracks deploy_failed at the lease_create stage with the api's code and status when the lease is refused", async () => {
      const refusal = new ApiError(402, { code: "insufficient_funds", message: "Not enough credits" }, "POST /v1/leases → 402");
      const { result, analyticsService } = await renderLeasingFlow({ createLease: mockMutation(vi.fn((_i, o) => o.onError(refusal))) });

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", {
        ...FAILED_DEPLOY,
        stage: "lease_create",
        errorCode: "insufficient_funds",
        errorStatus: 402,
        errorKind: "insufficient_funds"
      });
    });

    it("tells a failed auto deploy apart from a provider the user picked", async () => {
      const { result, analyticsService } = await renderLeasingFlow({ createLease: mockMutation(vi.fn((_i, o) => o.onError(new Error("network")))) });

      act(() => result.current.actions.deploy("sdl", { isAutoDeploy: true }));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", {
        ...FAILED_DEPLOY,
        stage: "lease_create",
        isAutoDeploy: true,
        errorKind: "unknown"
      });
    });

    it("classifies a lease that timed out at the gateway, which answers without the api's error code", async () => {
      const gatewayTimeout = new ApiError(504, "<html>Gateway Timeout</html>", "POST /v1/leases → 504");
      const { result, analyticsService } = await renderLeasingFlow({ createLease: mockMutation(vi.fn((_i, o) => o.onError(gatewayTimeout))) });

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, stage: "lease_create", errorStatus: 504, errorKind: "timeout" });
    });

    it("tracks one deploy_failed per failed attempt", async () => {
      const { result, analyticsService, rerender } = await renderLeasingFlow({ createLease: mockMutation(vi.fn((_i, o) => o.onError(new Error("network")))) });

      act(() => result.current.actions.deploy("sdl"));
      rerender();
      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track.mock.calls.filter(([name]) => name === "deploy_failed")).toHaveLength(2);
    });

    it("tracks no deploy_failed for a deploy that goes through", async () => {
      const { result, analyticsService } = await renderLeasingFlow({ createLease: mockMutation(vi.fn((_i, o) => o.onSuccess(deployedResult("akash1owner")))) });

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).not.toHaveBeenCalledWith("deploy_failed", expect.anything());
    });

    it("tracks deploy_failed at the not_started stage when there is no deployment to deploy yet", () => {
      const createLease = mockMutation();
      const { result, analyticsService } = renderFlow({ createLease });

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", { ...FAILED_DEPLOY, dseq: null, stage: "not_started" });
      expect(createLease.mutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("configuring");
    });

    it("tracks no deploy_failed for a deploy of a deployment the user discarded", () => {
      const { result, analyticsService } = renderFlow({ intent: { dseq: "555" } });
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.discard());

      act(() => result.current.actions.deploy("sdl"));

      expect(analyticsService.track).not.toHaveBeenCalledWith("deploy_failed", expect.anything());
    });

    function renderResumedFlow(input: NonNullable<Parameters<typeof renderFlow>[0]>) {
      const flow = renderFlow({
        intent: { dseq: "555" },
        getDeployment: mockMutation(
          vi.fn(),
          vi.fn(async () => ({ data: { consoleSettings: { sdl: "stored-sdl" } } }))
        ),
        patchDeployment: mockMutation(),
        servicesPatchBetween: () => ({ web: { image: "nginx:2" } }),
        ...input
      });
      act(() => flow.result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      return flow;
    }

    async function renderLeasingFlow(input: NonNullable<Parameters<typeof renderFlow>[0]>) {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } })));
      const flow = renderFlow({ createDeployment, ...input });
      act(() => flow.result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => flow.result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      return flow;
    }
  });

  describe("when a deploy the user confirmed takes too long", () => {
    const TIMED_OUT_DEPLOY = { category: "deployments", stage: "lease_timeout", dseq: "555", isAutoDeploy: false, inBackground: true };
    const LEASE_REQUEST = { async: "true", manifest: "M", leases: [{ dseq: "555", gseq: 1, oseq: 3, provider: "akash1a" }] };

    it("reports the timeout and tells the user once 30 s pass with neither a lease nor an activity", async () => {
      vi.useFakeTimers();
      try {
        const { result, analyticsService } = await renderDeployingFlow();

        act(() => vi.advanceTimersByTime(29_999));

        expect(result.current.isDeployTakingLong).toBe(false);
        expect(analyticsService.track).not.toHaveBeenCalledWith("deploy_failed", expect.anything());

        act(() => vi.advanceTimersByTime(1));

        expect(result.current.isDeployTakingLong).toBe(true);
        expect(result.current.phase).toBe("deploying");
        expect(analyticsService.track).toHaveBeenCalledWith("deploy_failed", TIMED_OUT_DEPLOY);
      } finally {
        vi.useRealTimers();
      }
    });

    it("reports the timeout once however long the deploy keeps running", async () => {
      vi.useFakeTimers();
      try {
        const { result, analyticsService } = await renderDeployingFlow();

        act(() => vi.advanceTimersByTime(30_000));
        act(() => vi.advanceTimersByTime(120_000));

        expect(result.current.isDeployTakingLong).toBe(true);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("times a deploy held up before its lease is even requested", async () => {
      vi.useFakeTimers();
      try {
        const patch = deferredMutate();
        const { result, lease } = await renderDeployingFlow({
          patchDeployment: mockMutation(patch.mutate),
          manifestFromSdl: () => "M2",
          servicesPatchBetween: () => ({ web: { env: { FOO: "bar" } } })
        });
        await act(async () => {});

        act(() => vi.advanceTimersByTime(30_000));

        expect(patch.calls).toHaveLength(1);
        expect(lease.calls).toHaveLength(0);
        expect(result.current.isDeployTakingLong).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("leaves an auto deploy untimed, since the autopilot follows its own deploy", async () => {
      vi.useFakeTimers();
      try {
        const { result, analyticsService } = await renderDeployingFlow({ isAutoDeploy: true });

        act(() => vi.advanceTimersByTime(30_000));

        expect(result.current.isDeployTakingLong).toBe(false);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([
      { case: "the lease is created", answer: deployedResult("akash1owner") },
      { case: "the api takes the lease on in the background", answer: { data: { activityId: "activity-1" } } }
    ])("stops timing once $case", async ({ answer }) => {
      vi.useFakeTimers();
      try {
        const { result, analyticsService, lease } = await renderDeployingFlow();
        act(() => vi.advanceTimersByTime(29_000));

        await act(async () => lease.calls[0].options.onSuccess?.(answer));
        act(() => vi.advanceTimersByTime(30_000));

        expect(result.current.isDeployTakingLong).toBe(false);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops timing once the lease request fails, which the deploy error already reports", async () => {
      vi.useFakeTimers();
      try {
        const { result, analyticsService, lease } = await renderDeployingFlow();
        act(() => vi.advanceTimersByTime(29_000));

        act(() => lease.calls[0].options.onError?.(new Error("network")));
        act(() => vi.advanceTimersByTime(30_000));

        expect(result.current.phase).toBe("quoting");
        expect(result.current.isDeployTakingLong).toBe(false);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops timing a deployment the user discarded before its lease was sent", async () => {
      vi.useFakeTimers();
      try {
        const patch = deferredMutate();
        const { result, analyticsService } = await renderDeployingFlow({
          patchDeployment: mockMutation(patch.mutate),
          servicesPatchBetween: () => ({}),
          secrets: { API_KEY: "x" }
        });
        await act(async () => {});

        act(() => result.current.actions.discard());
        act(() => vi.advanceTimersByTime(30_000));

        expect(result.current.isDeployTakingLong).toBe(false);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("stops timing once the page is gone", async () => {
      vi.useFakeTimers();
      try {
        const { unmount, analyticsService } = await renderDeployingFlow();

        unmount();
        act(() => vi.advanceTimersByTime(30_000));

        expect(timeoutsReportedBy(analyticsService)).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("finishes the deploy when the slow lease lands after all", async () => {
      vi.useFakeTimers();
      try {
        const { result, lease } = await renderDeployingFlow();
        act(() => vi.advanceTimersByTime(30_000));

        act(() => lease.calls[0].options.onSuccess?.(deployedResult("akash1owner")));

        expect(result.current.deploySucceeded).toBe(true);
        expect(result.current.isDeployTakingLong).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it("goes back to the bids of the same deployment without closing it", async () => {
      vi.useFakeTimers();
      try {
        const { result, closeDeployment } = await renderDeployingFlow();
        act(() => vi.advanceTimersByTime(30_000));

        act(() => result.current.actions.refreshQuotes());

        expect(result.current.phase).toBe("quoting");
        expect(result.current.dseq).toBe("555");
        expect(result.current.selections).toEqual({ "placement-1": "akash1a/555/1/3" });
        expect(result.current.isDeployTakingLong).toBe(false);
        expect(closeDeployment.mutate).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("sends the same lease for the same deployment again on retry, and times the retry afresh", async () => {
      vi.useFakeTimers();
      try {
        const { result, lease, createDeployment, analyticsService } = await renderDeployingFlow();
        act(() => vi.advanceTimersByTime(30_000));

        act(() => result.current.actions.deploy("sdl"));

        expect(result.current.isDeployTakingLong).toBe(false);
        expect(createDeployment.mutate).toHaveBeenCalledTimes(1);
        expect(lease.calls.map(call => call.args)).toEqual([LEASE_REQUEST, LEASE_REQUEST]);

        act(() => vi.advanceTimersByTime(29_999));
        expect(result.current.isDeployTakingLong).toBe(false);

        act(() => vi.advanceTimersByTime(1));
        expect(result.current.isDeployTakingLong).toBe(true);
        expect(timeoutsReportedBy(analyticsService)).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("leaves the flow to a retry still patching when the deploy it replaced fails its lease", async () => {
      vi.useFakeTimers();
      try {
        const { result, lease, patch, markOutcomeHandled } = await renderRetrySentWhilePatching({ hasReplacedDeployReachedLease: true });

        act(() => lease.calls[0].options.onError?.(new Error("boom")));

        expect(result.current.phase).toBe("deploying");
        expect(result.current.deployError).toBeUndefined();
        expect(markOutcomeHandled).not.toHaveBeenCalledWith("lease_create", "555", "failed");

        act(() => patch.calls[1].options.onSuccess?.({}));
        act(() => lease.calls[1].options.onSuccess?.(deployedResult("akash1owner")));

        expect(result.current.deploySucceeded).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it("leaves the flow to a retry still patching when the deploy it replaced fails its patch", async () => {
      vi.useFakeTimers();
      try {
        const { result, patch, analyticsService } = await renderRetrySentWhilePatching({ hasReplacedDeployReachedLease: false });

        act(() => patch.calls[0].options.onError?.(new Error("boom")));

        expect(result.current.phase).toBe("deploying");
        expect(result.current.deployError).toBeUndefined();
        expect(analyticsService.track).not.toHaveBeenCalledWith("deploy_failed", expect.objectContaining({ stage: "patch" }));
      } finally {
        vi.useRealTimers();
      }
    });

    it("finishes the deploy once, through the retry, when the deploy it replaced lands its lease while the retry patches", async () => {
      vi.useFakeTimers();
      try {
        const { result, lease, patch, router } = await renderRetrySentWhilePatching({ hasReplacedDeployReachedLease: true });

        act(() => lease.calls[0].options.onSuccess?.(deployedResult("akash1owner")));

        expect(result.current.deploySucceeded).toBe(false);

        act(() => patch.calls[1].options.onSuccess?.({}));
        act(() => lease.calls[1].options.onSuccess?.(deployedResult("akash1owner")));
        act(() => vi.advanceTimersByTime(1_200));

        expect(result.current.deploySucceeded).toBe(true);
        expect(router.replace.mock.calls.filter(([url]) => url === UrlService.deploymentDetails("555", "EVENTS", "events"))).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    function timeoutsReportedBy(analyticsService: ReturnType<typeof renderFlow>["analyticsService"]) {
      return analyticsService.track.mock.calls.filter(
        ([name, properties]) => name === "deploy_failed" && (properties as Record<string, unknown>).stage === "lease_timeout"
      );
    }

    it("stops reporting a lease in flight once the deploy it replaced answers, after the retry failed its patch", async () => {
      vi.useFakeTimers();
      try {
        const { result, lease, patch } = await renderRetrySentWhilePatching({ hasReplacedDeployReachedLease: true });

        act(() => patch.calls[1].options.onError?.(new Error("boom")));
        expect(result.current.isLeaseInFlight).toBe(true);

        act(() => lease.calls[0].options.onError?.(new Error("boom")));

        expect(result.current.isLeaseInFlight).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    async function renderRetrySentWhilePatching(input: { hasReplacedDeployReachedLease: boolean }) {
      const secrets = { API_KEY: "x" };
      const patch = deferredMutate();
      const flow = await renderDeployingFlow({ patchDeployment: mockMutation(patch.mutate), servicesPatchBetween: () => ({}), secrets });
      await act(async () => {});
      if (input.hasReplacedDeployReachedLease) act(() => patch.calls[0].options.onSuccess?.({}));
      act(() => vi.advanceTimersByTime(30_000));
      act(() => flow.result.current.actions.deploy("sdl", { secrets }));
      await act(async () => {});
      return { ...flow, patch };
    }

    async function renderDeployingFlow(
      input: { isAutoDeploy?: boolean; secrets?: Record<string, string> } & NonNullable<Parameters<typeof renderFlow>[0]> = {}
    ) {
      const { isAutoDeploy, secrets, ...flowInput } = input;
      const lease = deferredMutate();
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } })));
      const closeDeployment = mockMutation();
      const flow = renderFlow({ createDeployment, closeDeployment, createLease: mockMutation(lease.mutate), ...flowInput });
      act(() => flow.result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => flow.result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => flow.result.current.actions.deploy("sdl", { isAutoDeploy, secrets }));
      return { ...flow, lease, createDeployment, closeDeployment };
    }
  });

  describe("leasing", () => {
    it("reports a lease in flight from sending it until it answers", async () => {
      const { mutate } = deferredMutate();
      const { result } = await renderReadyToLease({ createLease: mockMutation(mutate) });
      expect(result.current.isLeaseInFlight).toBe(false);

      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.isLeaseInFlight).toBe(true);
    });

    it.each([
      ["is created", (options: SettledBy) => options.onSuccess?.(deployedResult("akash1owner"))],
      ["fails", (options: SettledBy) => options.onError?.(new Error("network"))]
    ])("reports no lease in flight once the lease %s", async (_, settle) => {
      const { mutate, calls } = deferredMutate();
      const { result } = await renderReadyToLease({ createLease: mockMutation(mutate) });
      act(() => result.current.actions.deploy("sdl"));

      act(() => settle(calls[0].options));

      expect(result.current.isLeaseInFlight).toBe(false);
    });

    it("keeps the deployment open when discarded while its lease is in flight, since the lease may still land", async () => {
      const closeDeployment = mockMutation();
      const { result } = await renderReadyToLease({ createLease: mockMutation(), closeDeployment });
      act(() => result.current.actions.deploy("sdl"));

      act(() => result.current.actions.discard());

      expect(closeDeployment.mutate).not.toHaveBeenCalled();
    });

    it("closes the deployment when discarded once its lease has failed", async () => {
      const closeDeployment = mockMutation();
      const { result } = await renderReadyToLease({ createLease: mockMutation(vi.fn((_i, o) => o.onError(new Error("network")))), closeDeployment });
      act(() => result.current.actions.deploy("sdl"));

      act(() => result.current.actions.discard());

      expect(closeDeployment.mutate).toHaveBeenCalledWith({ dseq: "555", async: "true" }, expect.any(Object));
    });

    it("lets the autopilot lease another provider once the api says the provider could not be reached", async () => {
      const refusal = new ApiError(502, { code: "provider_unreachable", message: "Provider could not be reached" }, "POST /v1/leases → 502");
      const { result } = await renderReadyToLease({ createLease: mockMutation(vi.fn((_i, o) => o.onError(refusal))) });

      act(() => result.current.actions.deploy("sdl"));

      expect(result.current.deployError).toEqual({ message: "Provider could not be reached", canLeaseElsewhere: true });
    });

    it("gives no lease failure to a deploy that failed before sending its lease", async () => {
      const refusal = new ApiError(400, { code: "invalid_sdl", message: "Invalid SDL" }, "PATCH /v1/deployments/555 → 400");
      const { result } = renderFlow({
        intent: { dseq: "555" },
        getDeployment: mockMutation(
          vi.fn(),
          vi.fn(async () => ({ data: { consoleSettings: { sdl: "stored-sdl" } } }))
        ),
        patchDeployment: mockMutation(vi.fn((_i, o) => o.onError(refusal))),
        servicesPatchBetween: () => ({ web: { image: "nginx:2" } })
      });
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));

      act(() => result.current.actions.deploy("sdl-b"));

      await waitFor(() => expect(result.current.deployError).toEqual({ message: "Invalid SDL", canLeaseElsewhere: false }));
    });

    async function renderReadyToLease(input: NonNullable<Parameters<typeof renderFlow>[0]>) {
      const createDeployment = mockMutation(vi.fn((_i, o) => o.onSuccess({ data: { dseq: "555", manifest: "M" } })));
      const flow = renderFlow({ createDeployment, ...input });
      act(() => flow.result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => flow.result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      return flow;
    }

    type SettledBy = ReturnType<typeof deferredMutate>["calls"][number]["options"];
  });

  describe("discard", () => {
    it("closes the open deployment in the background without leaving the current phase or touching the url", () => {
      const replace = vi.fn();
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, replace, closeMutate });

      act(() => result.current.actions.discard());

      expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
      expect(result.current.phase).toBe("quoting");
      expect(replace).not.toHaveBeenCalled();
    });

    it("closes a deployment an earlier close left open", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close failed")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });
      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.pendingClose).toMatchObject({ dseq: "777", failed: true });

      act(() => result.current.actions.discard());

      expect(closeMutate).toHaveBeenCalledTimes(2);
      expect(closeMutate).toHaveBeenLastCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it("never leases a deployment it discarded, since the page may linger before it navigates away", () => {
      const createLease = mockMutation();
      const { result } = renderFlow({ intent: { dseq: "555" }, createLease });
      act(() => result.current.actions.selectProvider("placement-1", "akash1a/555/1/3"));
      act(() => result.current.actions.discard());

      act(() => result.current.actions.deploy("sdl"));

      expect(createLease.mutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("quoting");
    });

    it("discards only once however often it is asked", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.discard());
      act(() => result.current.actions.discard());

      expect(closeMutate).toHaveBeenCalledTimes(1);
    });

    it("stops the no-bid timeout from closing and editing a discarded deployment", () => {
      vi.useFakeTimers();
      try {
        const replace = vi.fn();
        const closeMutate = vi.fn();
        const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, replace, closeMutate });
        act(() => result.current.actions.discard());

        act(() => vi.advanceTimersByTime(60_000));

        expect(closeMutate).toHaveBeenCalledTimes(1);
        expect(replace).not.toHaveBeenCalled();
        expect(result.current.error).toBeUndefined();
      } finally {
        vi.useRealTimers();
      }
    });

    it("closes what a create still in flight opens, even once the page is gone", () => {
      const createMutate = vi.fn();
      const { result, services, closeDeployment } = setup({ createMutate });
      act(() => result.current.actions.requestQuotes("sdl"));

      act(() => result.current.actions.discard());
      act(() => hookOptionsOf(services.api.v1.createDeployment.useMutation).onSuccess?.({ data: { dseq: "999", manifest: "m" } }));

      expect(closeDeployment.mutate).toHaveBeenCalledWith({ dseq: "999", async: "true" });
    });

    it("closes a create in flight only once when the page is still there to see it resolve", async () => {
      let resolveCreate: ((result: { data: { dseq: string; manifest: string } }) => void) | undefined;
      const createMutate = vi.fn((_args, options) => {
        resolveCreate = options.onSuccess;
      });
      const { result, services, closeDeployment } = setup({ createMutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.discard());

      act(() => {
        hookOptionsOf(services.api.v1.createDeployment.useMutation).onSuccess?.({ data: { dseq: "999", manifest: "m" } });
        resolveCreate?.({ data: { dseq: "999", manifest: "m" } });
      });

      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(closeDeployment.mutate).toHaveBeenCalledTimes(1);
      expect(result.current.dseq).toBeNull();
    });

    it("leaves a create that was never discarded to the attempt that made it", () => {
      const { services, closeDeployment } = setup({ createMutate: vi.fn() });

      act(() => hookOptionsOf(services.api.v1.createDeployment.useMutation).onSuccess?.({ data: { dseq: "999", manifest: "m" } }));

      expect(closeDeployment.mutate).not.toHaveBeenCalled();
    });

    it("drops a create queued behind a close", () => {
      const closeMutate = vi.fn();
      const createMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });
      act(() => result.current.actions.requestQuotes("sdl"));

      act(() => result.current.actions.discard());
      act(() => closeMutate.mock.calls[0][1].onSuccess({ data: { success: true } }));

      expect(createMutate).not.toHaveBeenCalled();
    });

    it("refreshes the deployment lists once a discarded deployment's close settles, even once the page is gone", () => {
      const { result, services, queryClient } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate: vi.fn() });
      act(() => result.current.actions.discard());

      act(() => hookOptionsOf(services.api.v1.closeDeployment.useMutation).onSettled?.());

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listDeployments"] });
    });

    it("leaves list refreshes to the close itself while nothing was discarded", () => {
      const { services, queryClient } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" } });

      act(() => hookOptionsOf(services.api.v1.closeDeployment.useMutation).onSettled?.());

      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    });
  });

  describe("cancel and edit close reliability", () => {
    it("stays in configuring and auto-closes the deployment when cancelled while it is still being created", async () => {
      const replace = vi.fn();
      let resolveCreate: ((result: { data: { dseq: string; manifest: string } }) => void) | undefined;
      const createMutate = vi.fn((_args, options) => {
        resolveCreate = options.onSuccess;
      });
      const { result, closeDeployment } = setup({ replace, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      expect(result.current.phase).toBe("creating");

      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.phase).toBe("configuring");

      act(() => resolveCreate?.({ data: { dseq: "999", manifest: "m" } }));

      expect(result.current.phase).toBe("configuring");
      expect(result.current.dseq).toBeNull();
      expect(closeDeployment.mutate).toHaveBeenCalledWith({ dseq: "999", async: "true" }, expect.any(Object));
      expect(replace.mock.calls.every(([url]) => !String(url).includes("/configure/999"))).toBe(true);
    });

    it("tracks cancel_during_create when cancelling while the deployment is being created", () => {
      const { result, analyticsService } = setup({ createMutate: vi.fn() });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track).toHaveBeenCalledWith("cancel_during_create", { category: "deployments" });
    });

    it("tracks close_deployment_failed when the close of a create cancelled in flight fails", async () => {
      let resolveCreate: ((result: { data: { dseq: string; manifest: string } }) => void) | undefined;
      const createMutate = vi.fn((_args, options) => {
        resolveCreate = options.onSuccess;
      });
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("auto close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result, analyticsService } = setup({ createMutate, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => resolveCreate?.({ data: { dseq: "999", manifest: "m" } }));

      expect(analyticsService.track).toHaveBeenCalledWith("close_deployment_failed", { category: "deployments", dseq: "999", verifiedClosed: false });
    });

    it("closes the still-open deployment before creating when requesting quotes with a live dseq", async () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();

      expect(closeMutate).toHaveBeenCalledWith({ dseq: "777" }, expect.any(Object));
      expect(createMutate).toHaveBeenCalledWith(
        { async: "true", data: { sdl: "sdl", sealedSecrets: "SEALED", deposit: expect.any(Number) } },
        expect.any(Object)
      );
      expect(result.current.dseq).toBe("1000");
      expect(result.current.phase).toBe("quoting");
    });

    it("does not create and surfaces a close error when the pre-create close is verified still open", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const createMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      expect(result.current.phase).toBe("error");
      expect(result.current.error?.kind).toBe("close");
      expect(result.current.dseq).toBeNull();
      expect(result.current.pendingClose).toEqual(expect.objectContaining({ dseq: "777", failed: true }));
      expect(createMutate).not.toHaveBeenCalled();
    });

    it("returns to configuring without error when a failed close is verified already closed", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "closed" } } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
      expect(result.current.dseq).toBeNull();
      expect(result.current.pendingClose).toBeNull();
    });

    it("returns to configuring without error when a failed close verifies as a 404", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onError?.(new ApiError(404, undefined, "GET deployment → 404")));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
      expect(result.current.dseq).toBeNull();
      expect(result.current.pendingClose).toBeNull();
    });

    it("surfaces a failed background close as a retryable notice rather than an error scene", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
      expect(result.current.pendingClose).toEqual(expect.objectContaining({ dseq: "777", failed: true }));
    });

    it("tracks close_deployment_failed with the verified outcome on a failed close", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "closed" } } }));
      const { result, analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track).toHaveBeenCalledWith("close_deployment_failed", { category: "deployments", dseq: "777", verifiedClosed: true });
    });

    it("drops the queued create when cancelled while the pre-create close is still in flight", () => {
      const closeCallbacks: Array<(result: unknown) => void> = [];
      const closeMutate = vi.fn((_args, options) => closeCallbacks.push(options.onSuccess));
      const createMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));
      expect(result.current.phase).toBe("creating");
      expect(closeMutate).toHaveBeenCalledTimes(1);

      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.phase).toBe("configuring");
      expect(closeMutate).toHaveBeenCalledTimes(1);

      act(() => closeCallbacks[0]?.({}));

      expect(createMutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("configuring");
      expect(result.current.dseq).toBeNull();
    });

    it("surfaces a background close failure as a notice instead of clobbering a cancelled-and-reconfigured session", () => {
      const closeCalls: Array<{ onSuccess?: (result: unknown) => void; onError?: (cause: unknown) => void }> = [];
      const closeMutate = vi.fn((_args, options) => closeCalls.push(options));
      const verifyCalls: Array<(result: { data: { deployment: { state: string } } }) => void> = [];
      const getDeploymentMutate = vi.fn((_args, options) => verifyCalls.push(options.onSuccess));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => closeCalls[0]?.onError?.(new Error("close boom")));
      expect(result.current.phase).toBe("creating");

      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.phase).toBe("configuring");

      act(() => verifyCalls[0]?.({ data: { deployment: { state: "active" } } }));

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
      expect(result.current.pendingClose).toEqual(expect.objectContaining({ dseq: "777", failed: true }));
    });

    it("clears a prior error when cancelling, so a stale failure does not follow the user into editing", async () => {
      const createMutate = vi.fn((_args, options) => options.onError?.(new Error("create boom")));
      const { result } = setup({ createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      expect(result.current.phase).toBe("error");

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.phase).toBe("configuring");
      expect(result.current.error).toBeUndefined();
    });

    it("does not track cancel_during_create when the create is still queued behind a close, since none was sent", () => {
      const closeMutate = vi.fn();
      const createMutate = vi.fn();
      const { result, analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));
      expect(result.current.phase).toBe("creating");
      expect(createMutate).not.toHaveBeenCalled();

      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track).not.toHaveBeenCalledWith("cancel_during_create", { category: "deployments" });
    });

    it("reports the retried close as still settling, so the warning does not vanish into apparent success", () => {
      const closeCalls: Array<{ onError?: (cause: unknown) => void }> = [];
      const closeMutate = vi.fn((_args, options) => closeCalls.push(options));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());
      act(() => closeCalls[0]?.onError?.(new Error("close boom")));
      expect(result.current.pendingClose?.failed).toBe(true);

      act(() => result.current.actions.retryClose());

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: false });
    });

    it("does not track cancel_during_create when cancelling a deployment that already exists", () => {
      const closeMutate = vi.fn();
      const { result, analyticsService } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track).not.toHaveBeenCalledWith("cancel_during_create", { category: "deployments" });
    });

    it("does not track cancel_during_create when nothing is being created", () => {
      const { result, analyticsService } = setup({});

      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track).not.toHaveBeenCalledWith("cancel_during_create", { category: "deployments" });
    });

    it("reports the close still settling so the form can flag it without blocking", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: false });
    });

    it("clears the pending close once it settles", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.pendingClose).toBeNull();
    });

    it("queues a requested create behind the in-flight background close instead of opening a second deployment", async () => {
      const closeCallbacks: Array<(result: unknown) => void> = [];
      const closeMutate = vi.fn((_args, options) => closeCallbacks.push(options.onSuccess));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.phase).toBe("configuring");

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      expect(createMutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("creating");

      act(() => closeCallbacks[0]?.({ data: { success: true } }));

      await settleSeal();

      expect(closeMutate).toHaveBeenCalledTimes(1);
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(result.current.dseq).toBe("1000");
      expect(result.current.phase).toBe("quoting");
    });

    it("closes the deployment before creating, so two are never open at once", async () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();

      expect(closeMutate.mock.invocationCallOrder[0]).toBeLessThan(createMutate.mock.invocationCallOrder[0]);
    });

    it("skips the create and surfaces a close error when the close it was queued behind verifies still open", () => {
      const closeCalls: Array<{ onError?: (cause: unknown) => void }> = [];
      const closeMutate = vi.fn((_args, options) => closeCalls.push(options));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const createMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate, createMutate });

      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl"));
      act(() => closeCalls[0]?.onError?.(new Error("close boom")));

      expect(createMutate).not.toHaveBeenCalled();
      expect(result.current.phase).toBe("error");
      expect(result.current.error?.kind).toBe("close");
      expect(result.current.pendingClose).toEqual(expect.objectContaining({ dseq: "777", failed: true }));
    });

    it("closes a deployment a previous close left open before creating a new one", async () => {
      const closeCalls: Array<{ onSuccess?: (result: unknown) => void; onError?: (cause: unknown) => void }> = [];
      const closeMutate = vi.fn((_args, options) => closeCalls.push(options));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate, createMutate });

      act(() => result.current.actions.cancelAndEdit());
      act(() => closeCalls[0]?.onError?.(new Error("close boom")));
      expect(result.current.pendingClose).toEqual(expect.objectContaining({ dseq: "777", failed: true }));

      act(() => result.current.actions.requestQuotes("sdl"));

      await settleSeal();
      expect(createMutate).not.toHaveBeenCalled();

      act(() => closeCalls[1]?.onSuccess?.({ data: { success: true } }));
      await settleSeal();

      expect(closeCalls).toHaveLength(2);
      expect(closeMutate).toHaveBeenLastCalledWith({ dseq: "777" }, expect.any(Object));
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(result.current.dseq).toBe("1000");
    });

    it("retryClose re-closes a deployment a background close left open", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, getDeploymentMutate });

      act(() => result.current.actions.cancelAndEdit());
      expect(result.current.pendingClose?.failed).toBe(true);

      act(() => result.current.actions.retryClose());

      expect(closeMutate).toHaveBeenCalledTimes(2);
      expect(closeMutate).toHaveBeenLastCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it("ignores retryClose while a close is already in flight", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.retryClose());

      expect(closeMutate).toHaveBeenCalledTimes(1);
    });

    it("does not fire a second close when cancel is pressed while one is already settling", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.cancelAndEdit());

      expect(closeMutate).toHaveBeenCalledTimes(1);
    });

    it("refreshes the balance and deployment lists once the background close lands, so the freed deposit shows up", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const { result, queryClient, services } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getBalancesKey("akash1owner") });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getDeploymentListKey("akash1owner") });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: services.api.v1.listDeployments.getKey() });
    });
  });

  describe("closing in the background", () => {
    it("closes a cancelled deployment in the background", () => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());
      expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it.each([
      { action: "closeAndFail", act: (actions: DeploymentFlowActions) => actions.closeAndFail("No provider matched") },
      { action: "discard", act: (actions: DeploymentFlowActions) => actions.discard() }
    ])("closes in the background when $action gives the deployment up", ({ act: giveUp }) => {
      const closeMutate = vi.fn();
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => giveUp(result.current.actions));

      expect(closeMutate).toHaveBeenCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it("retries a close left open in the background", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate,
        getDeploymentMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      act(() => result.current.actions.retryClose());

      expect(closeMutate).toHaveBeenLastCalledWith({ dseq: "777", async: "true" }, expect.any(Object));
    });

    it("keeps reporting the close as settling once the api accepts it, and has the feed fetch it", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, queryClient, useLatestActivitiesQuery } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: false });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
      expect(queryClient.invalidateQueries).not.toHaveBeenCalledWith({ queryKey: QueryKeys.getBalancesKey("akash1owner") });
      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: true });
    });

    it("leaves the feed alone while no close is running in the background", () => {
      const { useLatestActivitiesQuery } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" } });

      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    });

    it("waits while the feed still reports the close running", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, feed, rerender } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      feed.activities = [buildActivity({ id: "activity-2", status: "succeeded" }), buildActivity({ id: "activity-1", status: "pending" })];
      rerender();

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: false });
    });

    it("clears the close and refreshes the balance and lists once the feed reports it closed", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, feed, rerender, queryClient, useLatestActivitiesQuery } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      feed.activities = [buildActivity({ id: "activity-1", status: "succeeded" })];
      rerender();

      expect(result.current.pendingClose).toBeNull();
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: QueryKeys.getBalancesKey("akash1owner") });
      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    });

    it("reports the deployment still open, with the feed's reason, once its background close fails", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, feed, rerender } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      feed.activities = [
        buildActivity({
          id: "activity-1",
          status: "failed",
          meta: { dseq: "777", error: { code: "close_incomplete", message: "The deployment is still open. Try closing it again." } }
        })
      ];
      rerender();

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: true, message: "The deployment is still open. Try closing it again." });
      expect(result.current.phase).toBe("configuring");
    });

    it("tracks close_deployment_failed once the feed reports a background close failed", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, feed, rerender, analyticsService } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      feed.activities = [buildActivity({ id: "activity-1", status: "failed" })];
      rerender();

      expect(analyticsService.track).toHaveBeenCalledWith("close_deployment_failed", { category: "deployments", dseq: "777", verifiedClosed: false });
    });

    it("tracks no close failure once the feed reports a background close succeeded", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { activityId: "activity-1" } }));
      const { result, feed, rerender, analyticsService } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate
      });
      act(() => result.current.actions.cancelAndEdit());

      feed.activities = [buildActivity({ id: "activity-1", status: "succeeded" })];
      rerender();

      expect(analyticsService.track).not.toHaveBeenCalledWith("close_deployment_failed", expect.anything());
    });

    it("reports a close the api refused without a reason as still open with no message", () => {
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("network down")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate,
        getDeploymentMutate
      });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.pendingClose).toEqual({ dseq: "777", failed: true, message: undefined });
      expect(result.current.pendingClose).not.toHaveProperty("message", null);
    });

    it("clears the close at once when the api closed the deployment during the request", () => {
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate });

      act(() => result.current.actions.cancelAndEdit());

      expect(result.current.pendingClose).toBeNull();
    });

    it("closes a deployment still closing in the background during the request before creating, so two are never open at once", async () => {
      const closeCalls: Array<{ args: unknown; options: { onSuccess?: (result: unknown) => void } }> = [];
      const closeMutate = vi.fn((args, options) => closeCalls.push({ args, options }));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });
      act(() => result.current.actions.cancelAndEdit());
      act(() => closeCalls[0].options.onSuccess?.({ data: { activityId: "activity-1" } }));

      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      expect(createMutate).not.toHaveBeenCalled();
      act(() => closeCalls[1].options.onSuccess?.({ data: { success: true } }));
      await settleSeal();

      expect(closeCalls[1].args).toEqual({ dseq: "777" });
      expect(createMutate).toHaveBeenCalledTimes(1);
      expect(result.current.dseq).toBe("1000");
    });

    it("closes during the request a deployment whose background close the api accepts while a create waits on it", async () => {
      const closeCalls: Array<{ args: unknown; options: { onSuccess?: (result: unknown) => void } }> = [];
      const closeMutate = vi.fn((args, options) => closeCalls.push({ args, options }));
      const createMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));
      const { result } = setup({ intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" }, closeMutate, createMutate });
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl"));

      act(() => closeCalls[0].options.onSuccess?.({ data: { activityId: "activity-1" } }));
      act(() => closeCalls[1].options.onSuccess?.({ data: { success: true } }));
      await settleSeal();

      expect(closeCalls[1].args).toEqual({ dseq: "777" });
      expect(createMutate).toHaveBeenCalledTimes(1);
    });

    it("ignores the outcome of a background close a later close took over", async () => {
      const closeCalls: Array<{ options: { onSuccess?: (result: unknown) => void } }> = [];
      const closeMutate = vi.fn((_args, options) => closeCalls.push({ options }));
      const createMutate = vi.fn();
      const { result, feed, rerender, useLatestActivitiesQuery } = setup({
        intent: { sdlStrategy: "edit", bidStrategy: "select", dseq: "777" },
        closeMutate,
        createMutate
      });
      act(() => result.current.actions.cancelAndEdit());
      act(() => closeCalls[0].options.onSuccess?.({ data: { activityId: "activity-1" } }));
      act(() => result.current.actions.requestQuotes("sdl"));
      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
      act(() => closeCalls[1].options.onSuccess?.({ data: { success: true } }));
      await settleSeal();

      feed.activities = [
        buildActivity({ id: "activity-1", status: "failed", meta: { dseq: "777", error: { code: "close_failed", message: "Something went wrong" } } })
      ];
      rerender();

      expect(result.current.pendingClose).toBeNull();
    });
  });

  describe("a create cancelled while still in flight", () => {
    it("reports its deployment as closing once it lands", async () => {
      const creates = deferredMutate();
      const { result } = setup({ createMutate: creates.mutate, closeMutate: vi.fn() });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());

      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));

      expect(result.current.pendingClose).toEqual({ dseq: "999", failed: false });
    });

    it("reports its deployment still open once its close fails, and closes it again on retry", async () => {
      const creates = deferredMutate();
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ createMutate: creates.mutate, closeMutate, getDeploymentMutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));
      expect(result.current.pendingClose).toMatchObject({ dseq: "999", failed: true });

      act(() => result.current.actions.retryClose());

      expect(closeMutate).toHaveBeenCalledTimes(2);
      expect(closeMutate).toHaveBeenLastCalledWith({ dseq: "999", async: "true" }, expect.any(Object));
    });

    it("closes its deployment in the background", async () => {
      const creates = deferredMutate();
      const closeMutate = vi.fn();
      const { result } = setup({ createMutate: creates.mutate, closeMutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());

      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));

      expect(closeMutate).toHaveBeenCalledWith({ dseq: "999", async: "true" }, expect.any(Object));
    });

    it("holds the next create until it lands", async () => {
      const creates = deferredMutate();
      const { result } = setup({ createMutate: creates.mutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());

      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      expect(creates.mutate).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe("creating");
    });

    it("closes its deployment during the request before the held create runs, so two are never open at once", async () => {
      const creates = deferredMutate();
      const closes = deferredMutate();
      const { result } = setup({ createMutate: creates.mutate, closeMutate: closes.mutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));
      expect(closes.calls[0].args).toEqual({ dseq: "999" });
      expect(creates.mutate).toHaveBeenCalledTimes(1);
      act(() => closes.calls[0].options.onSuccess?.({ data: { success: true } }));
      await settleSeal();

      expect(creates.mutate).toHaveBeenCalledTimes(2);
      expect(creates.calls[1].args).toEqual({ data: expect.objectContaining({ sdl: "sdl-2" }), async: "true" });
    });

    it("runs the held create once it fails without opening a deployment, and reports nothing about it", async () => {
      const creates = deferredMutate();
      const { result } = setup({ createMutate: creates.mutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-2"));

      act(() => creates.calls[0].options.onError?.(new Error("create boom")));
      await settleSeal();

      expect(creates.mutate).toHaveBeenCalledTimes(2);
      expect(result.current.error).toBeUndefined();
      expect(result.current.phase).toBe("creating");
    });

    it("sends the next create straight out once it fails without opening a deployment", async () => {
      const creates = deferredMutate();
      const { result } = setup({ createMutate: creates.mutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => creates.calls[0].options.onError?.(new Error("create boom")));

      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      expect(creates.mutate).toHaveBeenCalledTimes(2);
      expect(creates.calls[1].args).toEqual({ async: "true", data: expect.objectContaining({ sdl: "sdl-2" }) });
    });

    it("drops the held create and shows the close error when its deployment stays open", async () => {
      const creates = deferredMutate();
      const closeMutate = vi.fn((_args, options) => options.onError?.(new Error("close boom")));
      const getDeploymentMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { deployment: { state: "active" } } }));
      const { result } = setup({ createMutate: creates.mutate, closeMutate, getDeploymentMutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-2"));

      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));
      await settleSeal();

      expect(creates.mutate).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe("error");
      expect(result.current.error?.kind).toBe("close");
      expect(result.current.pendingClose).toMatchObject({ dseq: "999", failed: true });
    });

    it("drops the held create when it is cancelled too", async () => {
      const creates = deferredMutate();
      const closeMutate = vi.fn((_args, options) => options.onSuccess?.({ data: { success: true } }));
      const { result } = setup({ createMutate: creates.mutate, closeMutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-2"));
      act(() => result.current.actions.cancelAndEdit());

      act(() => creates.calls[0].options.onSuccess?.({ data: { dseq: "999", manifest: "m" } }));
      await settleSeal();

      expect(closeMutate).toHaveBeenCalledWith({ dseq: "999", async: "true" }, expect.any(Object));
      expect(creates.mutate).toHaveBeenCalledTimes(1);
      expect(result.current.phase).toBe("configuring");
    });

    it("tracks cancel_during_create once when the create cancelled next was still held behind it", async () => {
      const creates = deferredMutate();
      const { result, analyticsService } = setup({ createMutate: creates.mutate });
      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();
      act(() => result.current.actions.cancelAndEdit());
      act(() => result.current.actions.requestQuotes("sdl-2"));

      act(() => result.current.actions.cancelAndEdit());

      expect(analyticsService.track.mock.calls.filter(([event]) => event === "cancel_during_create")).toHaveLength(1);
    });

    it("closes in the background what it opens once the page is gone", () => {
      const { result, services, closeDeployment } = setup({ createMutate: vi.fn() });
      act(() => result.current.actions.requestQuotes("sdl"));

      act(() => result.current.actions.discard());
      act(() => hookOptionsOf(services.api.v1.createDeployment.useMutation).onSuccess?.({ data: { dseq: "999", manifest: "m" } }));

      expect(closeDeployment.mutate).toHaveBeenCalledWith({ dseq: "999", async: "true" });
    });
  });

  describe("creating in the background", () => {
    it("asks the api to finish the create in the background", async () => {
      const { createMutate } = await setupBackgroundCreate({});

      expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sdl: "sdl" }), async: "true" }), expect.any(Object));
    });

    it("shows the create as in progress once the api accepts it, with the deployment in the URL and the page free to leave", async () => {
      const replace = vi.fn();
      const { result, queryClient, useLatestActivitiesQuery, services, accept } = await setupBackgroundCreate({ replace });

      act(() => accept());

      expect(result.current).toMatchObject({ phase: "creating", dseq: "1000", isCreatingInBackground: true });
      expect(replace).toHaveBeenLastCalledWith(UrlService.configureDeployment({ dseq: "1000", bidStrategy: "select" }), undefined, { shallow: true });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
      expect(services.api.v1.getActivity.useQuery).toHaveBeenLastCalledWith({ id: "activity-1" }, { enabled: true, refetchInterval: 5_000 });
      expect(useLatestActivitiesQuery).toHaveBeenLastCalledWith({ enabled: false });
    });

    it("holds the create_deployment event for the create's activity rather than tracking it when the create is accepted", async () => {
      const { holdActivityEvents, analyticsService, accept } = await setupBackgroundCreate({});

      act(() => accept());

      expect(holdActivityEvents).toHaveBeenCalledWith("activity-1", {
        succeeded: [{ event: "create_deployment", properties: { category: "deployments", label: "Create deployment in wizard", dseq: "1000", secretCount: 0 } }]
      });
      expect(analyticsService.track).not.toHaveBeenCalledWith("create_deployment", expect.anything());
    });

    it("keeps the create in progress while its activity still reports it running", async () => {
      const { result, api, rerender, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [buildActivity({ id: "activity-2", status: "succeeded" }), createActivity("pending")];
      rerender();

      expect(result.current).toMatchObject({ phase: "creating", isCreatingInBackground: true });
    });

    it("moves on to choosing a provider once its activity reports the deployment created", async () => {
      const { result, api, rerender, services, analyticsService, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [createActivity("succeeded")];
      rerender();

      expect(result.current).toMatchObject({ phase: "quoting", dseq: "1000", isCreatingInBackground: false });
      expect(services.api.v1.getActivity.useQuery).toHaveBeenLastCalledWith({ id: "" }, { enabled: false, refetchInterval: 5_000 });
      expect(analyticsService.track).not.toHaveBeenCalledWith("create_deployment", expect.anything());
    });

    it.each([
      { meta: { dseq: "1000", error: { code: "create_incomplete", message: "The deployment was not created." } }, message: "The deployment was not created." },
      { meta: { dseq: "1000" }, message: undefined }
    ])("hands the form back with its activity's reason ($message) once the create fails, dropping the deployment", async ({ meta, message }) => {
      const replace = vi.fn();
      const { result, api, rerender, accept } = await setupBackgroundCreate({ replace });
      act(() => accept());

      api.activities = [buildActivity({ id: "activity-1", type: "deployment_create", status: "failed", meta })];
      rerender();

      expect(result.current).toMatchObject({ phase: "error", dseq: null, error: { message, kind: "create" }, isCreatingInBackground: false });
      expect(replace).toHaveBeenLastCalledWith(UrlService.configureDeployment({ bidStrategy: "select" }), undefined, { shallow: true });
    });

    it("tracks create_deployment_failed once its activity reports the create failed", async () => {
      const { api, rerender, analyticsService, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [createActivity("failed")];
      rerender();

      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment_failed", { category: "deployments", kind: "create", inBackground: true });
    });

    it("does not track create_deployment_failed once its activity reports the deployment created", async () => {
      const { api, rerender, analyticsService, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [createActivity("succeeded")];
      rerender();

      expect(analyticsService.track).not.toHaveBeenCalledWith("create_deployment_failed", expect.anything());
    });

    it("creates again at once after a background create failed", async () => {
      const { result, api, rerender, createMutate, accept } = await setupBackgroundCreate({});
      act(() => accept());
      api.activities = [createActivity("failed")];
      rerender();

      act(() => result.current.actions.requestQuotes("sdl"));
      await settleSeal();

      expect(createMutate).toHaveBeenCalledTimes(2);
    });

    it("keeps today's flow when the api answers a create made during the request", async () => {
      const { result, holdActivityEvents, analyticsService, createCalls } = await setupBackgroundCreate({});

      act(() => createCalls[0].options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));

      expect(result.current).toMatchObject({ phase: "quoting", dseq: "1000", isCreatingInBackground: false });
      expect(analyticsService.track).toHaveBeenCalledWith("create_deployment", expect.objectContaining({ dseq: "1000" }));
      expect(holdActivityEvents).not.toHaveBeenCalled();
    });

    it("marks a create the api answered during the request as shown on its page, rather than following it", async () => {
      const { markOutcomeHandled, followUntilSettled, createCalls } = await setupBackgroundCreate({});

      act(() => createCalls[0].options.onSuccess?.({ data: { dseq: "1000", manifest: "m" } }));

      expect(markOutcomeHandled).toHaveBeenCalledWith("deployment_create", "1000", "succeeded");
      expect(followUntilSettled).not.toHaveBeenCalled();
    });

    it("tells the activity host it follows a create the api took on in the background, so the host leaves its outcome to the page", async () => {
      const { followUntilSettled, markOutcomeHandled, accept } = await setupBackgroundCreate({});

      act(() => accept());

      expect(followUntilSettled).toHaveBeenCalledWith("activity-1");
      expect(markOutcomeHandled).not.toHaveBeenCalled();
    });

    it.each(["succeeded", "failed"] as const)("keeps the host off a create that %s while the page stayed, even once the page is gone", async status => {
      const { api, rerender, unmount, stopFollowing, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [createActivity(status)];
      rerender();
      unmount();

      expect(stopFollowing).not.toHaveBeenCalled();
    });

    it("hands a create still being created back to the activity host when the page goes, so its toast brings the user back", async () => {
      const { api, rerender, unmount, stopFollowing, accept } = await setupBackgroundCreate({});
      act(() => accept());

      api.activities = [createActivity("pending")];
      rerender();
      unmount();

      expect(stopFollowing).toHaveBeenCalledWith("activity-1");
    });

    it("waits until a cancelled background create exists before closing it", async () => {
      const { result, api, rerender, closeMutate, analyticsService, accept } = await setupBackgroundCreate({});
      act(() => accept());

      act(() => result.current.actions.cancelAndEdit());
      const closedBeforeCreated = closeMutate.mock.calls.length;
      api.activities = [createActivity("succeeded")];
      rerender();

      expect(closedBeforeCreated).toBe(0);
      expect(analyticsService.track).toHaveBeenCalledWith("cancel_during_create", { category: "deployments" });
      expect(result.current).toMatchObject({ phase: "configuring", dseq: null });
      expect(closeMutate).toHaveBeenCalledWith({ dseq: "1000", async: "true" }, expect.any(Object));
    });

    it("closes nothing when a cancelled background create fails", async () => {
      const { result, api, rerender, closeMutate, accept } = await setupBackgroundCreate({});
      act(() => accept());
      act(() => result.current.actions.cancelAndEdit());

      api.activities = [createActivity("failed")];
      rerender();

      expect(closeMutate).not.toHaveBeenCalled();
      expect(result.current).toMatchObject({ phase: "configuring", error: undefined });
    });

    it("follows a create the api accepts only after it was cancelled, closing it once it exists", async () => {
      const replace = vi.fn();
      const { result, api, rerender, closeMutate, holdActivityEvents, createCalls } = await setupBackgroundCreate({ replace });
      act(() => result.current.actions.cancelAndEdit());

      act(() => createCalls[0].options.onSuccess?.({ data: { dseq: "1000", manifest: "m", activityId: "activity-1" } }));
      api.activities = [createActivity("succeeded")];
      rerender();

      expect(holdActivityEvents).not.toHaveBeenCalled();
      expect(replace.mock.calls.every(([url]) => !String(url).includes("/configure/1000"))).toBe(true);
      expect(result.current).toMatchObject({ phase: "configuring", dseq: null, isCreatingInBackground: false });
      expect(closeMutate).toHaveBeenCalledWith({ dseq: "1000", async: "true" }, expect.any(Object));
    });

    it("queues a new create behind one still being created, closing that one first once it exists", async () => {
      const { result, api, rerender, closeMutate, createMutate, accept } = await setupBackgroundCreate({});
      act(() => accept());

      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();
      const stateWhileQueued = { ...result.current };
      api.activities = [createActivity("succeeded")];
      rerender();
      act(() => closeMutate.mock.calls[0][1].onSuccess?.({ data: { success: true } }));
      await settleSeal();

      expect(stateWhileQueued).toMatchObject({ phase: "creating", dseq: null, isCreatingInBackground: false });
      expect(closeMutate).toHaveBeenCalledWith({ dseq: "1000" }, expect.any(Object));
      expect(createMutate).toHaveBeenCalledTimes(2);
      expect(createMutate).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ sdl: "sdl-2" }) }), expect.any(Object));
    });

    it("sends a create queued behind a background create that fails without closing anything", async () => {
      const { result, api, rerender, closeMutate, createMutate, accept } = await setupBackgroundCreate({});
      act(() => accept());
      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      api.activities = [createActivity("failed")];
      rerender();
      await settleSeal();

      expect(closeMutate).not.toHaveBeenCalled();
      expect(createMutate).toHaveBeenCalledTimes(2);
    });

    it("leaves a background create alone when the page is discarded", async () => {
      const { result, closeMutate, services, accept } = await setupBackgroundCreate({});
      act(() => accept());

      act(() => result.current.actions.discard());
      act(() => hookOptionsOf(services.api.v1.createDeployment.useMutation).onSuccess?.({ data: { dseq: "1000", manifest: "m", activityId: "activity-1" } }));

      expect(closeMutate).not.toHaveBeenCalled();
    });
  });

  describe("handing a one-click deploy to the api", () => {
    it("asks the api to pick the provider and lease the deployment as well", async () => {
      const { createMutate } = await setupOneClickCreate({});

      expect(createMutate).toHaveBeenCalledWith(expect.objectContaining({ async: "true", autoLease: "true" }), expect.any(Object));
    });

    it("leaves the provider pick to the page for a deploy that is not one-click", async () => {
      const { createMutate } = await setupBackgroundCreate({});

      expect(createMutate.mock.calls[0][0]).not.toHaveProperty("autoLease");
    });

    it("leaves the provider pick to the page for a template the user edits", async () => {
      const { createMutate } = await setupOneClickCreate({ sdlStrategy: "edit" });

      expect(createMutate.mock.calls[0][0]).not.toHaveProperty("autoLease");
    });

    it("leaves the provider pick to the page once the user chose to pick it", async () => {
      const { createMutate } = await setupOneClickCreate({ bidStrategy: "select" });

      expect(createMutate.mock.calls[0][0]).not.toHaveProperty("autoLease");
    });

    it("hands the deploy over without adopting its deployment once the api answers that it leases it too", async () => {
      const replace = vi.fn();
      const { result, recordOneClickDeploy, holdActivityEvents, followUntilSettled, queryClient, services, acceptWithLease } = await setupOneClickCreate({
        replace
      });

      act(() => acceptWithLease());

      expect(result.current).toMatchObject({ phase: "creating", dseq: null, autoLeasedDseq: "1000", isCreatingInBackground: true });
      expect(recordOneClickDeploy).toHaveBeenCalledWith(
        "1000",
        UrlService.configureDeployment({ templateId: "hello-world", sdlStrategy: "default", bidStrategy: "auto" })
      );
      expect(holdActivityEvents).toHaveBeenCalledWith("activity-1", {
        succeeded: [
          { event: "create_deployment", properties: { category: "deployments", label: "Create deployment in wizard", dseq: "1000", secretCount: 0 } }
        ],
        failed: [{ event: "create_deployment_failed", properties: { category: "deployments", kind: "create", inBackground: true } }]
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["v1", "listActivities"] });
      expect(followUntilSettled).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(services.api.v1.getActivity.useQuery).toHaveBeenLastCalledWith({ id: "" }, { enabled: false, refetchInterval: 5_000 });
    });

    it("follows the create itself when the api leaves the provider pick to the page", async () => {
      const { result, recordOneClickDeploy, followUntilSettled, accept } = await setupOneClickCreate({});

      act(() => accept());

      expect(result.current).toMatchObject({ dseq: "1000", autoLeasedDseq: null, isCreatingInBackground: true });
      expect(followUntilSettled).toHaveBeenCalledWith("activity-1");
      expect(recordOneClickDeploy).not.toHaveBeenCalled();
    });

    it("closes nothing however the page is left once the deploy is handed over", async () => {
      const { result, closeMutate, api, rerender, acceptWithLease } = await setupOneClickCreate({});
      act(() => acceptWithLease());

      act(() => result.current.actions.discard());
      act(() => result.current.actions.cancelAndEdit());
      api.activities = [createActivity("succeeded")];
      rerender();

      expect(closeMutate).not.toHaveBeenCalled();
    });

    it("creates again at once after handing a deploy over", async () => {
      const { result, createMutate, acceptWithLease } = await setupOneClickCreate({});
      act(() => acceptWithLease());

      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      expect(createMutate).toHaveBeenCalledTimes(2);
    });

    it("sends a create queued behind one handed over, leaving the handed over one to the api", async () => {
      const { result, closeMutate, createMutate, recordOneClickDeploy, acceptWithLease } = await setupOneClickCreate({});
      act(() => result.current.actions.requestQuotes("sdl-2"));
      await settleSeal();

      act(() => acceptWithLease());
      await settleSeal();

      expect(createMutate).toHaveBeenCalledTimes(2);
      expect(closeMutate).not.toHaveBeenCalled();
      expect(recordOneClickDeploy).toHaveBeenCalledWith("1000", expect.any(String));
      expect(result.current.autoLeasedDseq).toBeNull();
    });
  });

  function setup(input: {
    intent?: { sdlStrategy: "default" | "edit"; bidStrategy: "auto" | "select"; dseq?: string; templateId?: string; draftId?: string; vm?: boolean };
    replace?: ReturnType<typeof vi.fn>;
    createMutate?: ReturnType<typeof vi.fn>;
    closeMutate?: ReturnType<typeof vi.fn>;
    getDeploymentMutate?: ReturnType<typeof vi.fn>;
    sealSdlSecrets?: typeof DEPENDENCIES.sealSdlSecrets;
    sealContextMutateAsync?: ReturnType<typeof vi.fn>;
    deployTargetProjectId?: string;
    bidList?: { bids: Array<{ bid: { state: string; id: { provider: string; dseq: string; gseq: number; oseq: number } } }> };
  }) {
    const forgetProject = vi.fn();
    const intent = { vm: false, ...(input.intent ?? { sdlStrategy: "edit" as const, bidStrategy: "select" as const, dseq: undefined }) };
    const feed: { activities?: Activity[] } = {};
    const api: { activities: Activity[] } = { activities: [] };
    const useLatestActivitiesQuery = vi.fn((_options: { enabled: boolean }) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), { data: feed.activities })
    );
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const createDeployment = mockMutation(input.createMutate);
    const closeDeployment = mockMutation(input.closeMutate);
    const getDeployment = mockMutation(input.getDeploymentMutate);
    const getSdlSecretsContext = mockSealContextMutation(input.sealContextMutateAsync);
    const sealSdlSecrets = vi.fn(input.sealSdlSecrets ?? (async () => "SEALED"));
    const markOutcomeHandled = vi.fn();
    const forgetEarlierOutcomes = vi.fn();
    const followUntilSettled = vi.fn();
    const stopFollowing = vi.fn();
    const holdActivityEvents = vi.fn();
    const recordOneClickDeploy = vi.fn();
    const services = mockServices({ createDeployment, closeDeployment, getDeployment, getSdlSecretsContext });
    services.api.v1.getActivity.useQuery.mockImplementation(({ id }) => {
      const activity = api.activities.find(candidate => candidate.id === id);
      return mock<ReturnType<typeof services.api.v1.getActivity.useQuery>>({ data: activity && { data: activity } });
    });
    const dependencies: typeof DEPENDENCIES = {
      useServices: (() => services) as never,
      useListBids: (() => ({ data: { data: input.bidList?.bids ?? [] }, isLoading: false, isError: false })) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: (input.replace ?? vi.fn()) as never })) as never,
      useQueryClient: (() => queryClient) as never,
      manifestFromSdl: () => "manifest",
      deploymentResourcesFromSdl: () => ({ gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 }),
      sealSdlSecrets,
      servicesPatchBetween,
      useLatestActivitiesQuery,
      useMarkActivityOutcomes: () =>
        mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>({ forgetEarlierOutcomes, markOutcomeHandled, followUntilSettled, stopFollowing }),
      useConfigureDeployTarget: () =>
        mock<ReturnType<typeof DEPENDENCIES.useConfigureDeployTarget>>({
          project: input.deployTargetProjectId ? mock<Project>({ id: input.deployTargetProjectId }) : undefined,
          forgetProject
        }),
      useHoldActivityEvents: () => holdActivityEvents,
      useRecordOneClickDeploy: () => recordOneClickDeploy
    };
    return {
      services,
      ...renderDeploymentFlow(intent, dependencies),
      feed,
      api,
      useLatestActivitiesQuery,
      analyticsService: services.analyticsService,
      queryClient,
      createDeployment,
      closeDeployment,
      getDeployment,
      getSdlSecretsContext,
      sealSdlSecrets,
      forgetProject,
      markOutcomeHandled,
      forgetEarlierOutcomes,
      followUntilSettled,
      stopFollowing,
      holdActivityEvents,
      recordOneClickDeploy
    };
  }

  function renderFlow(input?: {
    intent?: Partial<DeploymentIntent>;
    createDeployment?: ReturnType<typeof mockMutation>;
    createLease?: ReturnType<typeof mockMutation>;
    closeDeployment?: ReturnType<typeof mockMutation>;
    updateDeployment?: ReturnType<typeof mockMutation>;
    patchDeployment?: ReturnType<typeof mockMutation>;
    getDeployment?: ReturnType<typeof mockMutation>;
    manifestFromSdl?: (sdl: string) => string | null;
    deploymentResourcesFromSdl?: (sdl: string) => { gpuAmount: number; cpuAmount: number; memoryAmount: number; storageAmount: number };
    listBids?: Array<{ bid: { state: string; price: { amount: string; denom: string }; id: { provider: string; dseq: string; gseq: number; oseq: number } } }>;
    sealSdlSecrets?: typeof DEPENDENCIES.sealSdlSecrets;
    servicesPatchBetween?: typeof DEPENDENCIES.servicesPatchBetween;
    settingsId?: string | null;
  }) {
    const getSdlSecretsContext = mockSealContextMutation();
    const intent: DeploymentIntent = { sdlStrategy: "edit", bidStrategy: "select", dseq: undefined, vm: false, ...input?.intent };
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() });
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const services = mockServices({
      createDeployment: input?.createDeployment,
      closeDeployment: input?.closeDeployment,
      createLease: input?.createLease,
      updateDeployment: input?.updateDeployment,
      patchDeployment: input?.patchDeployment,
      getDeployment: input?.getDeployment,
      getSdlSecretsContext
    });
    const sealSdlSecrets = vi.fn(input?.sealSdlSecrets ?? (async () => "SEALED"));
    const markOutcomeHandled = vi.fn();
    const forgetEarlierOutcomes = vi.fn();
    const followUntilSettled = vi.fn();
    const stopFollowing = vi.fn();
    const holdActivityEvents = vi.fn<ReturnType<typeof DEPENDENCIES.useHoldActivityEvents>>();
    const recordOneClickDeploy = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useServices: (() => services) as never,
      useListBids: (() => ({ data: { data: input?.listBids ?? [] }, isLoading: false, isError: false })) as never,
      useRouter: () => router,
      useQueryClient: (() => queryClient) as never,
      manifestFromSdl: input?.manifestFromSdl ?? (() => "M"),
      deploymentResourcesFromSdl: input?.deploymentResourcesFromSdl ?? (() => ({ gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 })),
      sealSdlSecrets,
      servicesPatchBetween: input?.servicesPatchBetween ?? servicesPatchBetween,
      useLatestActivitiesQuery: () => mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>({ data: undefined }),
      useMarkActivityOutcomes: () =>
        mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>({ forgetEarlierOutcomes, markOutcomeHandled, followUntilSettled, stopFollowing }),
      useConfigureDeployTarget: () => mock<ReturnType<typeof DEPENDENCIES.useConfigureDeployTarget>>({ project: undefined }),
      useHoldActivityEvents: () => holdActivityEvents,
      useRecordOneClickDeploy: () => recordOneClickDeploy
    };
    const utils = renderDeploymentFlow(intent, dependencies, input?.settingsId);
    return {
      ...utils,
      router,
      queryClient,
      holdActivityEvents,
      recordOneClickDeploy,
      followUntilSettled,
      services,
      sealSdlSecrets,
      getSdlSecretsContext,
      deploymentLocalStorage: services.deploymentLocalStorage,
      analyticsService: services.analyticsService,
      markOutcomeHandled,
      forgetEarlierOutcomes
    };
  }

  function renderWithBidList(bidList: { data: { data: never[] } | undefined }) {
    const services = mockServices();
    const dependencies: typeof DEPENDENCIES = {
      useServices: (() => services) as never,
      useListBids: (() => ({ data: bidList.data, isLoading: bidList.data === undefined, isError: false })) as never,
      useRouter: (() => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace: vi.fn(), push: vi.fn() })) as never,
      useQueryClient: (() => mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>()) as never,
      manifestFromSdl: () => "M",
      deploymentResourcesFromSdl: () => ({ gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 }),
      sealSdlSecrets: async () => "SEALED",
      servicesPatchBetween,
      useLatestActivitiesQuery: () => mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>({ data: undefined }),
      useMarkActivityOutcomes: () => mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>(),
      useConfigureDeployTarget: () => mock<ReturnType<typeof DEPENDENCIES.useConfigureDeployTarget>>({ project: undefined }),
      useHoldActivityEvents: () => vi.fn(),
      useRecordOneClickDeploy: () => vi.fn()
    };
    return {
      ...renderDeploymentFlow({ sdlStrategy: "edit", bidStrategy: "select", dseq: "777", vm: false }, dependencies),
      analyticsService: services.analyticsService
    };
  }

  async function setupBackgroundCreate(input: { replace?: ReturnType<typeof vi.fn> }) {
    const { mutate: createMutate, calls: createCalls } = deferredMutate();
    const closeMutate = vi.fn();
    const view = setup({ replace: input.replace, createMutate, closeMutate });
    act(() => view.result.current.actions.requestQuotes("sdl"));
    await settleSeal();
    const accept = () => createCalls[0].options.onSuccess?.({ data: { dseq: "1000", manifest: "m", activityId: "activity-1" } });
    return { ...view, createMutate, createCalls, closeMutate, accept };
  }

  async function setupOneClickCreate(input: { replace?: ReturnType<typeof vi.fn>; sdlStrategy?: "default" | "edit"; bidStrategy?: "auto" | "select" }) {
    const { mutate: createMutate, calls: createCalls } = deferredMutate();
    const closeMutate = vi.fn();
    const view = setup({
      intent: { sdlStrategy: input.sdlStrategy ?? "default", bidStrategy: input.bidStrategy ?? "auto", templateId: "hello-world" },
      replace: input.replace,
      createMutate,
      closeMutate
    });
    act(() => view.result.current.actions.requestQuotes("sdl"));
    await settleSeal();
    const answer = (data: object) => createCalls[0].options.onSuccess?.({ data: { dseq: "1000", manifest: "m", activityId: "activity-1", ...data } });
    return { ...view, createMutate, createCalls, closeMutate, accept: () => answer({}), acceptWithLease: () => answer({ autoLease: true }) };
  }

  function createActivity(status: Activity["status"]) {
    return buildActivity({ id: "activity-1", type: "deployment_create", status, meta: { dseq: "1000" } });
  }

  async function settleSeal() {
    await act(async () => {});
  }

  function openBidOn(dseq: string) {
    return { bid: { state: "open", id: { provider: "akash1provider", dseq, gseq: 1, oseq: 1 } } };
  }

  function deferredMutate() {
    const calls: Array<{ args: unknown; options: { onSuccess?: (result: unknown) => void; onError?: (cause: unknown) => void } }> = [];
    const mutate = vi.fn((args: unknown, options: (typeof calls)[number]["options"]) => {
      calls.push({ args, options });
    });
    return { mutate, calls };
  }

  function mockMutation(mutate: ReturnType<typeof vi.fn> = vi.fn(), mutateAsync: ReturnType<typeof vi.fn> = vi.fn()) {
    return mock<{ mutate: ReturnType<typeof vi.fn>; mutateAsync: ReturnType<typeof vi.fn> }>({ mutate, mutateAsync });
  }

  function mockSealContextMutation(mutateAsync: ReturnType<typeof vi.fn> = vi.fn(async () => ({ data: SEAL_CONTEXT }))) {
    return mock<{ mutateAsync: ReturnType<typeof vi.fn> }>({ mutateAsync });
  }

  function mockServices(mutations?: {
    createDeployment?: ReturnType<typeof mockMutation>;
    closeDeployment?: ReturnType<typeof mockMutation>;
    createLease?: ReturnType<typeof mockMutation>;
    updateDeployment?: ReturnType<typeof mockMutation>;
    patchDeployment?: ReturnType<typeof mockMutation>;
    getDeployment?: ReturnType<typeof mockMutation>;
    getSdlSecretsContext?: ReturnType<typeof mockSealContextMutation>;
  }) {
    const services = mockDeep<ReturnType<typeof DEPENDENCIES.useServices>>();
    services.api.v1.getSDLSecretsContext.useMutation.mockReturnValue((mutations?.getSdlSecretsContext ?? mockSealContextMutation()) as never);
    services.api.v1.patchDeployment.useMutation.mockReturnValue((mutations?.patchDeployment ?? mockMutation()) as never);
    services.api.v1.createDeployment.useMutation.mockReturnValue((mutations?.createDeployment ?? mockMutation()) as never);
    services.api.v1.closeDeployment.useMutation.mockReturnValue((mutations?.closeDeployment ?? mockMutation()) as never);
    services.api.v1.createLease.useMutation.mockReturnValue((mutations?.createLease ?? mockMutation()) as never);
    services.api.v1.updateDeployment.useMutation.mockReturnValue((mutations?.updateDeployment ?? mockMutation()) as never);
    services.api.v1.getDeployment.useMutation.mockReturnValue((mutations?.getDeployment ?? mockMutation()) as never);
    services.api.v1.listDeployments.getKey.mockReturnValue(["v1", "listDeployments"]);
    services.api.v1.listActivities.getKey.mockReturnValue(["v1", "listActivities"]);
    services.api.v1.getSpendRate.getKey.mockReturnValue(["v1", "getSpendRate"]);
    services.api.v1.getActivity.useQuery.mockReturnValue(mock<ReturnType<typeof services.api.v1.getActivity.useQuery>>({ data: undefined }));
    return services;
  }

  function renderDeploymentFlow(intent: DeploymentIntent, dependencies: typeof DEPENDENCIES, settingsId: string | null = "akash1owner") {
    const store = createStore();
    store.set(settingsIdAtom, settingsId);
    const view = renderHook(() => useDeploymentFlow({ intent }, dependencies), {
      wrapper: ({ children }: PropsWithChildren) => <JotaiStoreProvider store={store}>{children}</JotaiStoreProvider>
    });
    return { ...view, store };
  }

  function hookOptionsOf(useMutation: { mock: { calls: unknown[][] } }) {
    return (useMutation.mock.calls.at(-1)?.[0] ?? {}) as {
      onSuccess?: (...args: unknown[]) => void;
      onSettled?: (...args: unknown[]) => void;
      meta?: Record<string, unknown>;
    };
  }

  type LeaseCallbacks = { onSuccess: (result: unknown) => void; onError: (cause: unknown) => void; onSettled: (result: unknown, error: unknown) => void };

  /** The create-lease success payload shape the flow reads the owner from. */
  function deployedResult(owner: string) {
    return { data: { deployment: { id: { owner } } } };
  }
});

describe(buildConfigureUrl.name, () => {
  it("preserves the draft id alongside the dseq and bid strategy", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", templateId: "tpl", draftId: "draft-1", vm: false }, "999", "auto");

    expect(url).toContain("/new-deployment/configure/999");
    expect(url).toContain("bid-strategy=auto");
    expect(url).toContain("draftId=draft-1");
  });

  it("omits the draft id when the intent carries none", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", vm: false }, undefined, "select");

    expect(url).not.toContain("draftId");
  });

  it("preserves the vm flag across rewrites", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", draftId: "draft-1", vm: true }, "999", "select");

    expect(url).toContain("/new-deployment/configure/999");
    expect(url).toContain("vm=true");
  });

  it("omits the vm flag for non-vm intents", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", vm: false }, undefined, "select");

    expect(url).not.toContain("vm=");
  });

  it("preserves the user template id across rewrites", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", userTemplateId: "user-1", draftId: "draft-1", vm: false }, "999", "select");

    expect(url).toContain("/new-deployment/configure/999");
    expect(url).toContain("userTemplateId=user-1");
    expect(url).toContain("draftId=draft-1");
  });

  it("omits the user template id when the intent carries none", () => {
    const url = buildConfigureUrl({ sdlStrategy: "edit", bidStrategy: "select", vm: false }, undefined, "select");

    expect(url).not.toContain("userTemplateId");
  });
});
