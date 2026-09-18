import { useCallback, useState } from "react";
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
  const UNREACHED_DEADLINE_MS = 10_000;
  const SHORT_DEADLINE_MS = 20;
  const DISARMABLE_DEADLINE_MS = 300;

  async function waitForDeadline() {
    await new Promise(resolve => setTimeout(resolve, SHORT_DEADLINE_MS * 4));
  }

  it("fires requestQuotes with the current SDL on mount when the flow is configuring", async () => {
    const { flow } = setup({ sdl: "sdl-content" });

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalledWith("sdl-content"));
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
    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("closes the deployment and fails the attempt when no bidder is reachable before the deadline", async () => {
    const { result, flow, analyticsService } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      matchDeadlineMs: SHORT_DEADLINE_MS
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
    await waitForDeadline();

    expect(flow.actions.selectProvider).not.toHaveBeenCalled();
    expect(flow.actions.closeAndFail).toHaveBeenCalledTimes(1);
    expect(result.current.state.kind).toBe("error");
    expect(analyticsService.track).toHaveBeenCalledWith(
      "onboarding_match_failed",
      expect.objectContaining({ reason: "deadline", numberOfBids: 1, numberOfCandidates: 1 })
    );
  });

  it("abandons the attempt as soon as the quote window expires, without waiting out the deadline", async () => {
    const { result, flow, analyticsService } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      quoteExpiry: { secondsLeft: 0, isExpired: true }
    });

    await vi.waitFor(() => expect(flow.actions.closeAndFail).toHaveBeenCalledTimes(1));
    expect(result.current.state.kind).toBe("error");
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_match_failed", expect.objectContaining({ reason: "quote_expired" }));
  });

  it("leaves a deployment that has drawn no bids to the flow's own timeout", async () => {
    const { flow } = setup({ bids: [], matchDeadlineMs: SHORT_DEADLINE_MS });

    await waitForDeadline();

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("does not abandon the attempt once the autopilot has been stopped for a manual hand-off", async () => {
    const { result, flow } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      matchDeadlineMs: SHORT_DEADLINE_MS
    });

    act(() => result.current.stopAutopilot());
    await waitForDeadline();

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("does not abandon the attempt once a provider is matched and the lease is away", async () => {
    const { flow } = setup({ matchDeadlineMs: SHORT_DEADLINE_MS });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    await waitForDeadline();

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("stops reconstructing a resumed lease once a retry has created a different deployment", async () => {
    const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 2, provider: PROVIDER_OWNER }];
    const { flow, actions } = setup({ initialDseq: DSEQ, bids: [], resumeLeases, requiredGseqs: [1], holdDeploy: true });

    await vi.waitFor(() => expect(actions.selectProvider).toHaveBeenCalled());
    actions.selectProvider.mockClear();
    act(() => {
      flow.replaceDseq("99999");
      flow.dropSelections();
    });
    await waitForDeadline();

    expect(actions.selectProvider).not.toHaveBeenCalled();
  });

  it("does not abandon a deployment another tab has already leased", async () => {
    const openBid = mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 1 } } });
    const leasedBid = mock<DeploymentBids[number]>({ bid: { state: "active", id: { provider: "akash1other", dseq: DSEQ, gseq: 1, oseq: 1 } } });
    const { flow } = setup({
      bids: [openBid, leasedBid],
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      matchDeadlineMs: SHORT_DEADLINE_MS
    });

    await waitForDeadline();

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("does not abandon the attempt after a failed deploy, whose error the scene already shows", async () => {
    const { flow } = setup({ holdDeploy: true, matchDeadlineMs: DISARMABLE_DEADLINE_MS });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    act(() => flow.setDeployError("lease failed"));
    await new Promise(resolve => setTimeout(resolve, DISARMABLE_DEADLINE_MS * 3));

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
  });

  it("creates a fresh deployment when tryAgain follows an abandoned attempt", async () => {
    const { result, flow } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      quoteExpiry: { secondsLeft: 0, isExpired: true }
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));
    act(() => result.current.tryAgain());

    expect(flow.actions.cancelAndEdit).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalledTimes(2));
  });

  it("matches a group again once the flow drops the selection its bid no longer backs", async () => {
    const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 3, provider: PROVIDER_OWNER }];
    const { flow } = setup({ initialDseq: DSEQ, resumeLeases, holdDeploy: true });

    await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1));
    act(() => flow.dropSelections());

    await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledTimes(2));
  });

  it("does not re-record a selection the flow still holds while bids keep polling", async () => {
    const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 3, provider: PROVIDER_OWNER }];
    const { flow } = setup({ initialDseq: DSEQ, resumeLeases, holdDeploy: true });

    await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
  });

  it("does not re-record a dropped selection after a failed deploy, which would re-fire the lease", async () => {
    const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 3, provider: PROVIDER_OWNER }];
    const { flow } = setup({ initialDseq: DSEQ, resumeLeases, holdDeploy: true });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
    act(() => flow.setDeployError("lease failed"));
    act(() => flow.dropSelections());
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
    expect(flow.actions.deploy).toHaveBeenCalledTimes(1);
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

  it("stops matching a provider and deploying, but still lets the deployment creation finish, once the autopilot is stopped", async () => {
    const { result, flow } = setup();

    // Stop synchronously right after mount — before the async reachability check resolves a provider — mirroring the
    // "Choose my provider" hand-off. The create has already fired (so the manual form inherits a live, quoting
    // deployment rather than a dangling one), but no provider is matched and no lease is created afterwards.
    act(() => result.current.stopAutopilot());

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(flow.actions.requestQuotes).toHaveBeenCalledTimes(1);
    expect(flow.actions.selectProvider).not.toHaveBeenCalled();
    expect(flow.actions.deploy).not.toHaveBeenCalled();
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

    it("reconstructs the selection from a live lease the guard resolved and lets deploy run", async () => {
      // The lease carries a distinct oseq from the open bid (oseq 1), proving the selection is rebuilt from the lease's
      // own coordinates and that an existing lease takes precedence over matching from bids.
      const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 3, provider: PROVIDER_OWNER }];
      const { result, flow } = setup({ initialDseq: DSEQ, resumeLeases });

      await vi.waitFor(() => expect(result.current.matchedProviderAddress).toBe(PROVIDER_OWNER));

      const resumedBidId = formatBidId({ provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 3 });
      expect(flow.actions.selectProvider).toHaveBeenCalledWith(resumedBidId, resumedBidId);
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    });
  });

  describe("with multiple placements", () => {
    const PROVIDER_A = "akash1providera";
    const PROVIDER_B = "akash1providerb";

    it("matches a reachable provider for each placement, recording a selection per group", async () => {
      const { providerA, providerB, bidA, bidB } = multiPlacement();
      const { flow } = setup({ providers: [providerA, providerB], bids: [bidA, bidB], requiredGseqs: [1, 2] });

      const bidAId = formatBidId({ provider: PROVIDER_A, dseq: DSEQ, gseq: 1, oseq: 1 });
      const bidBId = formatBidId({ provider: PROVIDER_B, dseq: DSEQ, gseq: 2, oseq: 1 });
      await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(bidAId, bidAId));
      await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(bidBId, bidBId));
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    });

    it("waits for every placement to be matched before firing deploy", async () => {
      const { providerA, providerB, bidA } = multiPlacement();
      // Only the first group has drawn a bid; the second is still searching, so deploy must not fire yet.
      const { result, flow } = setup({ providers: [providerA, providerB], bids: [bidA], requiredGseqs: [1, 2] });

      const bidAId = formatBidId({ provider: PROVIDER_A, dseq: DSEQ, gseq: 1, oseq: 1 });
      await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(bidAId, bidAId));

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
      expect(flow.actions.deploy).not.toHaveBeenCalled();
      expect(result.current.state.kind).toBe("matching");
    });

    it("reconstructs a selection from every live lease the guard resolved on resume", async () => {
      const { providerA, providerB } = multiPlacement();
      const resumeLeases = [
        { dseq: DSEQ, gseq: 1, oseq: 1, provider: PROVIDER_A },
        { dseq: DSEQ, gseq: 2, oseq: 1, provider: PROVIDER_B }
      ];
      const { flow } = setup({ initialDseq: DSEQ, providers: [providerA, providerB], bids: [], requiredGseqs: [1, 2], resumeLeases });

      const leaseAId = formatBidId({ provider: PROVIDER_A, dseq: DSEQ, gseq: 1, oseq: 1 });
      const leaseBId = formatBidId({ provider: PROVIDER_B, dseq: DSEQ, gseq: 2, oseq: 1 });
      await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(leaseAId, leaseAId));
      await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(leaseBId, leaseBId));
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    });

    // Two placements, each drawing a bid from its own reachable provider.
    function multiPlacement() {
      const providerA = mock<ApiProviderList>({ owner: PROVIDER_A, hostUri: "https://provider-a.example" });
      const providerB = mock<ApiProviderList>({ owner: PROVIDER_B, hostUri: "https://provider-b.example" });
      const bidA = mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_A, dseq: DSEQ, gseq: 1, oseq: 1 } } });
      const bidB = mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_B, dseq: DSEQ, gseq: 2, oseq: 1 } } });
      return { providerA, providerB, bidA, bidB };
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(input?: {
    sdl?: string;
    initialDseq?: string;
    bids?: DeploymentBids;
    providers?: ApiProviderList[];
    requiredGseqs?: number[];
    resumeLeases?: Array<{ dseq: string; gseq: number; oseq: number; provider: string }>;
    providerProxyRequest?: ReturnType<typeof vi.fn>;
    quoteExpiry?: { secondsLeft: number; isExpired: boolean } | null;
    holdDeploy?: boolean;
    matchDeadlineMs?: number;
  }) {
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

    const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
    const providers = input?.providers ?? [provider];
    const bid = mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 1 } } });
    const bids = input?.bids ?? [bid];

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
      closeAndFail: vi.fn(),
      setBidStrategy: vi.fn(),
      refreshQuotes: vi.fn(),
      retry: vi.fn(),
      clearSelection: vi.fn()
    };

    const flowControls: {
      setPhaseError: (message?: string) => void;
      setDeployError: (message?: string) => void;
      setClosing: () => void;
      dropSelections: () => void;
      replaceDseq: (next: string) => void;
    } = {
      setPhaseError: () => undefined,
      setDeployError: () => undefined,
      setClosing: () => undefined,
      dropSelections: () => undefined,
      replaceDseq: () => undefined
    };

    // A live, stateful stub of the base flow: it advances phase in response to the autopilot's action calls exactly as
    // the real `useDeploymentFlow` does, so the autopilot's effects fire against realistic transitions without the real
    // chain logic. Called inside the harness below and passed to the autopilot as its `flow` input.
    function useFlowStub({ intent }: { intent: { dseq?: string } }): DeploymentFlow {
      const [phase, setPhase] = useState<DeploymentFlow["phase"]>(intent.dseq ? "quoting" : "configuring");
      const [dseq, setDseq] = useState<string | null>(intent.dseq ?? DSEQ);
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
      flowControls.dropSelections = () => setSelections({});
      flowControls.replaceDseq = (next: string) => setDseq(next);

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
        if (input?.holdDeploy) return;
        setPhase("deploying");
        setDeploySucceeded(true);
      }, []);
      const closeAndFail = useCallback((message: string) => {
        actions.closeAndFail(message);
        setError({ message });
        setSelections({});
        setDseq(null);
        setPhase("error");
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
        actions: { ...actions, requestQuotes, selectProvider, deploy, retry, cancelAndEdit, closeAndFail }
      };
    }

    const publicConsoleApiHttpClient = { get: vi.fn().mockResolvedValue({ data: providers }) };

    // `useProviderList` is stubbed to hand back the candidate providers directly; the real `useFirstReachableProvider` runs
    // against the stubbed provider-proxy so reachability outcomes (reachable vs. unreachable) drive the autopilot for real.
    const useProviderList: typeof DEPENDENCIES.useProviderList = (() => ({ data: providers })) as never;

    // Stubbed group resolution so tests declare the placement count directly rather than crafting valid multi-group SDL.
    const getRequiredGseqs: typeof DEPENDENCIES.getRequiredGseqs = () => input?.requiredGseqs ?? [1];

    // Stubbed so the deadline's backstop is declared per test; unstubbed it would poll `useListBids`/`useBlock`.
    const useQuoteExpiry: typeof DEPENDENCIES.useQuoteExpiry = () => input?.quoteExpiry ?? null;

    const analyticsService = mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>();
    const logger = mock<ReturnType<typeof DEPENDENCIES.useServices>["logger"]>();
    const useServices: typeof DEPENDENCIES.useServices = (() => ({ analyticsService, logger })) as never;

    const view = setupQuery(
      () => {
        // The base flow lives outside the autopilot now, so the harness creates the live stub flow and passes it in —
        // `initialDseq` seeds the stub in `quoting` (a resume) or `configuring` (a fresh start).
        const flow = useFlowStub({ intent: { dseq: input?.initialDseq } });
        return useAutoDeploymentFlow(
          {
            sdl: input?.sdl ?? "sdl-content",
            resumeLeases: input?.resumeLeases,
            flow
          },
          {
            useServices,
            useProviderList,
            useFirstReachableProvider,
            useQuoteExpiry,
            getRequiredGseqs,
            matchDeadlineMs: input?.matchDeadlineMs ?? UNREACHED_DEADLINE_MS
          }
        );
      },
      {
        services: {
          providerProxy: () => providerProxy,
          publicConsoleApiHttpClient: () => publicConsoleApiHttpClient
        } as never
      }
    );

    return { ...view, actions, flow: { actions, ...flowControls }, providerProxy, analyticsService };
  }
});
