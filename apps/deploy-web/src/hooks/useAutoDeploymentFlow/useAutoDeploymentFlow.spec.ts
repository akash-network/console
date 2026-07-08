import { useCallback, useState } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentBids, DeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useFirstReachableProvider } from "@src/queries/useProvidersQuery";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId } from "@src/utils/bids/bidId";
import type { DEPENDENCIES } from "./useAutoDeploymentFlow";
import { useAutoDeploymentFlow } from "./useAutoDeploymentFlow";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

const PROVIDER_OWNER = "akash1provider";
const DSEQ = "12345";
const BID_ID = `${PROVIDER_OWNER}/${DSEQ}/1/1`;

describe(useAutoDeploymentFlow.name, () => {
  it("starts in the creating phase with the first phase active", () => {
    const { result } = setup({ isWalletReady: false });

    expect(result.current.state.kind).toBe("creating");
    expect(result.current.phases[0].status).toBe("active");
    expect(result.current.phases[1].status).toBe("pending");
    expect(result.current.phases[2].status).toBe("pending");
  });

  it("builds an auto intent seeded with the template, draft, and resumed dseq", () => {
    const { useDeploymentFlow } = setup({ templateId: "hello-world", draftId: "draft-1", initialDseq: DSEQ });

    expect(useDeploymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({ intent: { sdlStrategy: "default", bidStrategy: "auto", dseq: DSEQ, templateId: "hello-world", draftId: "draft-1" } })
    );
  });

  it("fires requestQuotes with the current SDL once the wallet is ready", async () => {
    const { flow } = setup({ sdl: "sdl-content" });

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalledWith("sdl-content"));
  });

  it("stays in creating without firing requestQuotes while the trial wallet is not yet ready", async () => {
    const { result, flow } = setup({ isWalletReady: false });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(result.current.state.kind).toBe("creating");
    expect(flow.actions.requestQuotes).not.toHaveBeenCalled();
  });

  it("projects to error without firing requestQuotes when the trial has terminally errored", async () => {
    const { result, flow } = setup({
      isWalletReady: false,
      trialError: new ApiError(400, { message: "Email not verified" }, "POST /v1/wallets/start-trial → 400")
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));

    expect(result.current.state).toEqual({ kind: "error", message: "Email not verified" });
    expect(flow.actions.requestQuotes).not.toHaveBeenCalled();
  });

  it("projects the underlying quoting phase to matching, with creating completed", async () => {
    const { result } = setup({ providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    expect(result.current.phases[0].status).toBe("completed");
    expect(result.current.phases[0].label).toBe("Deployment created");
    expect(result.current.phases[1].status).toBe("active");
  });

  it("projects to error when the underlying flow errors", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalled());
    act(() => flow.setPhaseError("Tx rejected by node"));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "Tx rejected by node" }));
  });

  it("stays in matching while no open bid is returned", async () => {
    const { result, flow } = setup({ bids: [] });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.state.kind).toBe("matching");
    expect(flow.actions.selectProvider).not.toHaveBeenCalled();
  });

  it("stays in matching without selecting while the matched provider is unreachable", async () => {
    const { result, flow } = setup({ providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")) });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(result.current.state.kind).toBe("matching");
    expect(result.current.matchedProviderAddress).toBeNull();
    expect(flow.actions.selectProvider).not.toHaveBeenCalled();
  });

  it("records the reachable provider as the flow's selection once found", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(result.current.matchedProviderAddress).toBe(PROVIDER_OWNER));

    expect(flow.actions.selectProvider).toHaveBeenCalledWith(BID_ID, BID_ID);
  });

  it("fires deploy with the current SDL once a selection exists", async () => {
    const { flow } = setup({ sdl: "sdl-content" });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledWith("sdl-content"));
  });

  it("projects to success once the underlying deploy succeeds", async () => {
    const { result } = setup();

    await vi.waitFor(() => expect(result.current.state.kind).toBe("success"));

    expect(result.current.phases.every(phase => phase.status === "completed")).toBe(true);
  });

  it("projects to error when the underlying deploy fails", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    act(() => flow.setDeployError("lease failed"));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "lease failed" }));
  });

  it("restarts progress at the create step while the old deployment is closing", async () => {
    const { result, flow } = setup({ bids: [] });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
    act(() => flow.setClosing());

    expect(result.current.state.kind).toBe("creating");
    expect(result.current.phases[0].status).toBe("active");
    expect(result.current.phases[1].status).toBe("pending");
  });

  it("closes the deployment and creates a fresh one when tryAgain is called after an error", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalledTimes(1));
    act(() => flow.setPhaseError("broadcast failed"));
    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));

    act(() => result.current.tryAgain());

    // closing the deployment returns the flow to configuring, from which the autopilot broadcasts a brand-new create
    await vi.waitFor(() => expect(flow.actions.cancelAndEdit).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current.state.kind).toBe("success"));
  });

  describe("when resuming with a dseq from the URL", () => {
    it("does not fire requestQuotes and starts in matching", async () => {
      const { result, flow } = setup({ initialDseq: DSEQ, bids: [] });

      expect(result.current.state.kind).toBe("matching");
      expect(result.current.phases[0].status).toBe("completed");
      expect(result.current.phases[1].status).toBe("active");

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(flow.actions.requestQuotes).not.toHaveBeenCalled();
    });

    it("reconstructs the selection from an existing active lease and lets deploy run", async () => {
      const getDeployment = vi.fn().mockResolvedValue({
        data: { leases: [{ id: { dseq: DSEQ, gseq: 2, oseq: 3, provider: PROVIDER_OWNER }, state: "active" }] }
      });
      const { result, flow } = setup({ initialDseq: DSEQ, getDeployment });

      await vi.waitFor(() => expect(result.current.matchedProviderAddress).toBe(PROVIDER_OWNER));

      const resumedBidId = formatBidId({ provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 2, oseq: 3 });
      expect(flow.actions.selectProvider).toHaveBeenCalledWith(resumedBidId, resumedBidId);
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(input?: {
    sdl?: string;
    initialDseq?: string;
    templateId?: string;
    draftId?: string;
    bids?: DeploymentBids;
    getDeployment?: ReturnType<typeof vi.fn>;
    providerProxyRequest?: ReturnType<typeof vi.fn>;
    isWalletReady?: boolean;
    trialError?: unknown;
  }) {
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

    const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
    const bid = mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 1 } } });
    const bids = input?.bids ?? [bid];

    const getDeployment = input?.getDeployment ?? vi.fn().mockResolvedValue({ data: { leases: [] } });
    const api = createProxy({ v1: { getDeployment } });

    const providerProxy = mock<ProviderProxyService>();
    if (input?.providerProxyRequest) {
      providerProxy.request.mockImplementation(input.providerProxyRequest as never);
    } else {
      providerProxy.request.mockResolvedValue({ data: {} } as never);
    }

    // Captures the action calls the autopilot makes and exposes hooks to simulate the underlying flow's terminal states.
    const actions = {
      requestQuotes: vi.fn(),
      selectProvider: vi.fn(),
      deploy: vi.fn(),
      cancelAndEdit: vi.fn(),
      setBidStrategy: vi.fn(),
      refreshQuotes: vi.fn(),
      retry: vi.fn(),
      clearSelection: vi.fn()
    };

    // A stateful stub state machine: it advances phase in response to the autopilot's action calls exactly as the real
    // `useDeploymentFlow` does, so the autopilot's effects fire against realistic transitions without the real chain logic.
    const flowControls: { setPhaseError: (message?: string) => void; setDeployError: (message?: string) => void; setClosing: () => void } = {
      setPhaseError: () => undefined,
      setDeployError: () => undefined,
      setClosing: () => undefined
    };

    const useDeploymentFlow = vi.fn(function useDeploymentFlowStub({ intent }: { intent: { dseq?: string } }): DeploymentFlow {
      const [phase, setPhase] = useState<DeploymentFlow["phase"]>(intent.dseq ? "quoting" : "configuring");
      const [dseq] = useState<string | null>(intent.dseq ?? DSEQ);
      const [selections, setSelections] = useState<Record<string, string>>({});
      const [deploySucceeded, setDeploySucceeded] = useState(false);
      const [deployError, setDeployError] = useState<{ message?: string } | undefined>(undefined);
      const [error, setError] = useState<{ message?: string } | undefined>(undefined);

      flowControls.setPhaseError = (message?: string) => {
        setError({ message });
        setPhase("error");
      };
      flowControls.setDeployError = (message?: string) => {
        setDeployError({ message });
        setPhase("quoting");
      };
      flowControls.setClosing = () => setPhase("closing");

      const requestQuotes = useCallback((sdl: string) => {
        actions.requestQuotes(sdl);
        setPhase("quoting");
      }, []);
      const selectProvider = useCallback((placementId: string, bidId: string) => {
        actions.selectProvider(placementId, bidId);
        setDeployError(undefined);
        setSelections(previous => ({ ...previous, [placementId]: bidId }));
      }, []);
      const deploy = useCallback((sdl: string) => {
        actions.deploy(sdl);
        setDeployError(undefined);
        setPhase("deploying");
        setDeploySucceeded(true);
      }, []);
      const retry = useCallback(() => {
        actions.retry();
        setError(undefined);
        setDeployError(undefined);
        setSelections({});
        setPhase(intent.dseq ? "quoting" : "configuring");
      }, []);
      const cancelAndEdit = useCallback(() => {
        actions.cancelAndEdit();
        setError(undefined);
        setDeployError(undefined);
        setSelections({});
        setDeploySucceeded(false);
        setPhase("configuring");
      }, []);

      return {
        phase,
        dseq,
        bidStrategy: "auto",
        selections,
        bids: phase === "quoting" ? bids : [],
        deploySucceeded,
        deployError,
        error,
        actions: { ...actions, requestQuotes, selectProvider, deploy, retry, cancelAndEdit }
      };
    });

    const publicConsoleApiHttpClient = { get: vi.fn().mockResolvedValue({ data: [provider] }) };

    // `useProviderList` is stubbed to hand back the candidate provider directly; the real `useFirstReachableProvider` runs
    // against the stubbed provider-proxy so reachability outcomes (reachable vs. unreachable) drive the autopilot for real.
    const useProviderList: typeof DEPENDENCIES.useProviderList = (() => ({ data: [provider] })) as never;

    const view = setupQuery(
      () =>
        useAutoDeploymentFlow(
          {
            sdl: input?.sdl ?? "sdl-content",
            isWalletReady: input?.isWalletReady ?? true,
            trialError: input?.trialError,
            initialDseq: input?.initialDseq,
            templateId: input?.templateId,
            draftId: input?.draftId
          },
          { useDeploymentFlow, useProviderList, useFirstReachableProvider }
        ),
      {
        services: {
          api: () => api,
          providerProxy: () => providerProxy,
          publicConsoleApiHttpClient: () => publicConsoleApiHttpClient
        } as never
      }
    );

    return { ...view, useDeploymentFlow, actions, flow: { actions, ...flowControls }, getDeployment, providerProxy };
  }
});
