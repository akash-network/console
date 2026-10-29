import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type {
  AbandonedAttemptKind,
  DeployError,
  DeploymentBids,
  DeploymentFlow,
  DeployOptions,
  FlowError
} from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { NO_PROVIDERS_MESSAGE } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { BID_POLL_INTERVAL } from "@src/queries/useListBids";
import { useFirstReachableProvider } from "@src/queries/useProvidersQuery";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId } from "@src/utils/bids/bidId";
import { DEPENDENCIES, useAutoDeploymentFlow } from "./useAutoDeploymentFlow";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";

const PROVIDER_OWNER = "akash1provider";
const DSEQ = "12345";
const BID_ID = `${PROVIDER_OWNER}/${DSEQ}/1/1`;

describe(useAutoDeploymentFlow.name, () => {
  const UNREACHED_DEADLINE_MS = 10_000;
  const SHORT_DEADLINE_MS = 20;
  const DEADLINE_PAST_WAIT_FOR_MS = 5_000;

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

  it("carries a refusal the user can pay their way out of, with its shortfall, onto the error state", async () => {
    const { result, flow } = setup();
    const shortfall = { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 };

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalled());
    act(() => flow.setFlowError({ kind: "needs-funds", message: "Not enough balance", shortfall }));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "Not enough balance", reason: "needs-funds", shortfall }));
  });

  it("gives a failure the user cannot pay their way out of no funding reason", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalled());
    act(() => flow.setFlowError({ kind: "create", message: "Invalid SDL" }));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "Invalid SDL" }));
  });

  it("marks a refusal a pending top up will clear so the screen asks the user to wait", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalled());
    act(() => flow.setFlowError({ kind: "top-up-pending", message: "A top up is on the way" }));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "A top up is on the way", reason: "top-up-pending" }));
  });

  it("marks a refusal by the project's budget with the project it names", async () => {
    const { result, flow } = setup();

    await vi.waitFor(() => expect(flow.actions.requestQuotes).toHaveBeenCalled());
    act(() => flow.setFlowError({ kind: "budget-exceeded", message: "Over budget", projectId: "storefront" }));

    await vi.waitFor(() => expect(result.current.state).toEqual({ kind: "error", message: "Over budget", reason: "budget-exceeded", projectId: "storefront" }));
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
    vi.useFakeTimers();
    const { result, flow, analyticsService } = setup({
      providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
      matchDeadlineMs: DEADLINE_PAST_WAIT_FOR_MS
    });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
    await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

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

  it("keeps waiting on a deployment no provider has bid on before the flow says the first bid is late", async () => {
    const { result, flow } = setup({ bids: [], matchDeadlineMs: SHORT_DEADLINE_MS, lateBidWaitMs: SHORT_DEADLINE_MS });

    await waitForDeadline();

    expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: false, hasBids: false });
  });

  describe("when the flow says the first bid is late", () => {
    it("tells the user providers are busy while it keeps waiting", async () => {
      const { result, flow } = setup({ bids: [] });
      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));

      act(() => flow.reportNoBids());

      expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: true, hasBids: false });
      expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
    });

    it("closes the deployment and ends on no providers once the wait for a late bid runs out", async () => {
      vi.useFakeTimers();
      const { result, flow, analyticsService } = setup({ bids: [], lateBidWaitMs: DEADLINE_PAST_WAIT_FOR_MS });
      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      act(() => flow.reportNoBids());

      await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

      expect(flow.actions.closeAndFail).toHaveBeenCalledWith(NO_PROVIDERS_MESSAGE, "no-providers");
      expect(result.current.state).toEqual({ kind: "error", message: NO_PROVIDERS_MESSAGE });
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_match_failed", { category: "onboarding", reason: "no_bids", dseq: DSEQ });
    });

    it("waits four minutes past the flow's one minute mark by default, five in all", async () => {
      vi.useFakeTimers();
      const { result, flow } = setup({ bids: [], lateBidWaitMs: DEPENDENCIES.lateBidWaitMs });
      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      act(() => flow.reportNoBids());

      await act(() => vi.advanceTimersByTimeAsync(4 * 60_000 - 1));
      expect(flow.actions.closeAndFail).not.toHaveBeenCalled();

      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(flow.actions.closeAndFail).toHaveBeenCalledTimes(1);
    });

    it("stops waiting once a late bid lands, leaving the match to its own deadline", async () => {
      vi.useFakeTimers();
      const { result, flow } = setup({
        bids: [],
        providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")),
        lateBidWaitMs: DEADLINE_PAST_WAIT_FOR_MS
      });
      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      act(() => flow.reportNoBids());

      act(() => flow.receiveBids([openBid()]));
      await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

      expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
      expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: false, hasBids: true });
    });

    it("leaves the deployment open once the autopilot has been stopped for a manual hand-off", async () => {
      vi.useFakeTimers();
      const { result, flow } = setup({ bids: [], lateBidWaitMs: DEADLINE_PAST_WAIT_FOR_MS });
      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      act(() => flow.reportNoBids());

      act(() => result.current.stopAutopilot());
      await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

      expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
    });
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
    vi.useFakeTimers();
    const { flow } = setup({ matchDeadlineMs: DEADLINE_PAST_WAIT_FOR_MS });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

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
    vi.useFakeTimers();
    const { flow } = setup({ holdDeploy: true, matchDeadlineMs: DEADLINE_PAST_WAIT_FOR_MS });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
    act(() => flow.setDeployError("lease failed"));
    await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS));

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

  it("fires deploy with the current SDL as an auto deploy once a selection exists", async () => {
    const { flow } = setup({ sdl: "sdl-content" });

    await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledWith("sdl-content", { isAutoDeploy: true }));
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

  it("restarts progress at the create step while a queued create waits on the old deployment's close", async () => {
    const { result, flow } = setup({ bids: [] });

    await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
    act(() => flow.setCreating());

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

  describe("recommending a bid for a manual pick", () => {
    const OTHER_PROVIDER = "akash1otherprovider";

    it("recommends the first open bid while no provider is matched yet, and says bids are in", async () => {
      const { result } = setup({ providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")) });

      await vi.waitFor(() => expect(result.current.recommendedBidIds).toEqual([BID_ID]));
      expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: false, hasBids: true });
    });

    it("recommends nothing while no provider has bid", async () => {
      const { result } = setup({ bids: [] });

      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      expect(result.current.recommendedBidIds).toEqual([]);
      expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: false, hasBids: false });
    });

    it("passes over bids that are no longer open or are for another placement", async () => {
      const closedBid = bidFrom(OTHER_PROVIDER, { state: "closed" });
      const otherPlacementBid = bidFrom(OTHER_PROVIDER, { gseq: 2 });
      const { result } = setup({
        bids: [closedBid, otherPlacementBid, openBid()],
        providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable"))
      });

      await vi.waitFor(() => expect(result.current.recommendedBidIds).toEqual([BID_ID]));
    });

    it("recommends the provider it matched over a bid that came in before it", async () => {
      const otherProvider = mock<ApiProviderList>({ owner: OTHER_PROVIDER, hostUri: "https://other-provider.example" });
      const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
      const { result, flow } = setup({
        bids: [bidFrom(OTHER_PROVIDER), openBid()],
        providers: [otherProvider, provider],
        providerProxyRequest: vi.fn((_path: string, options: { providerIdentity: { owner: string } }) =>
          options.providerIdentity.owner === OTHER_PROVIDER ? Promise.reject(new Error("unreachable")) : Promise.resolve({ data: {} })
        ),
        holdDeploy: true
      });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalled());
      expect(result.current.recommendedBidIds).toEqual([BID_ID]);
    });

    it("recommends nothing until every placement has an open bid", async () => {
      const bidForSecondPlacement = bidFrom(OTHER_PROVIDER, { gseq: 2 });
      const { result, flow } = setup({ requiredGseqs: [1, 2], providerProxyRequest: vi.fn().mockRejectedValue(new Error("unreachable")) });

      await vi.waitFor(() => expect(result.current.state.kind).toBe("matching"));
      expect(result.current.recommendedBidIds).toEqual([]);
      expect(result.current.state).toEqual({ kind: "matching", isWaitingForLateBids: false, hasBids: false });

      act(() => flow.receiveBids([openBid(), bidForSecondPlacement]));

      expect(result.current.recommendedBidIds).toEqual([BID_ID, formatBidId(bidForSecondPlacement.bid.id)]);
    });

    function bidFrom(provider: string, overrides?: { state?: string; gseq?: number }) {
      return mock<DeploymentBids[number]>({
        bid: { state: overrides?.state ?? "open", id: { provider, dseq: DSEQ, gseq: overrides?.gseq ?? 1, oseq: 1 } }
      });
    }
  });

  it("drops the providers it picked once the autopilot is stopped, so a manual pick leases on its own", async () => {
    const { result, flow } = setup({ holdDeploy: true });

    await vi.waitFor(() => expect(flow.actions.selectProvider).toHaveBeenCalledWith(BID_ID, BID_ID));
    act(() => result.current.stopAutopilot());

    expect(flow.actions.clearSelection).toHaveBeenCalledWith(BID_ID);
  });

  describe("when a lease fails", () => {
    const NEXT_PROVIDER = "akash1nextprovider";
    const NEXT_BID_ID = `${NEXT_PROVIDER}/${DSEQ}/1/1`;

    it("leases the next provider's bid once, dropping the provider that failed", async () => {
      const { flow } = setup({ ...withNextProvider(), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(2));
      expect(flow.actions.clearSelection).toHaveBeenCalledWith(BID_ID);
      expect(flow.actions.selectProvider).toHaveBeenLastCalledWith(NEXT_BID_ID, NEXT_BID_ID);
    });

    it("keeps matching the next provider through a probe that fails before it answers", async () => {
      vi.useFakeTimers();
      let isNextProviderUp = false;
      const probeNextProvider = vi.fn(() => (isNextProviderUp ? Promise.resolve({ data: {} }) : Promise.reject(new Error("unreachable"))));
      const { result, flow } = setup({ ...withNextProvider(), holdDeploy: true, providerProxyRequest: probeProviders(probeNextProvider) });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      probeNextProvider.mockClear();
      act(() => flow.setDeployError("lease failed", true));
      await vi.waitFor(() => expect(probeNextProvider).toHaveBeenCalledTimes(1));
      await act(() => vi.advanceTimersByTimeAsync(BID_POLL_INTERVAL / 2));
      expect(result.current.state.kind).toBe("matching");

      isNextProviderUp = true;
      await act(() => vi.advanceTimersByTimeAsync(BID_POLL_INTERVAL));

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(2));
      expect(flow.actions.selectProvider).toHaveBeenLastCalledWith(NEXT_BID_ID, NEXT_BID_ID);
    });

    it.each([
      { scenario: "its probe never answers", probeNextProvider: () => new Promise(() => undefined), hasNextProviderRecord: true },
      { scenario: "its probe keeps failing", probeNextProvider: () => Promise.reject(new Error("unreachable")), hasNextProviderRecord: true },
      { scenario: "it has no provider record to probe", probeNextProvider: () => Promise.resolve({ data: {} }), hasNextProviderRecord: false }
    ])(
      "shows the failure, leaving the deployment for a manual pick, when the next provider is unmatched at the deadline because $scenario",
      async ({ probeNextProvider, hasNextProviderRecord }) => {
        vi.useFakeTimers();
        const { result, flow } = setup({
          ...withNextProvider({ hasNextProviderRecord }),
          holdDeploy: true,
          providerProxyRequest: probeProviders(probeNextProvider),
          matchDeadlineMs: DEADLINE_PAST_WAIT_FOR_MS
        });

        await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
        act(() => flow.setDeployError("lease failed", true));
        await act(() => vi.advanceTimersByTimeAsync(DEADLINE_PAST_WAIT_FOR_MS - 1));
        expect(result.current.state.kind).toBe("matching");

        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(result.current.state).toEqual({ kind: "error", message: "lease failed", reason: "lease-failed" });
        expect(flow.actions.deploy).toHaveBeenCalledTimes(1);
        expect(flow.actions.closeAndFail).not.toHaveBeenCalled();
      }
    );

    it("shows the failure with another provider to pick once the next provider's lease fails too", async () => {
      const { result, flow } = setup({ ...withNextProvider(), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(2));
      act(() => flow.setDeployError("lease failed again", true));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(result.current.state).toEqual({ kind: "error", message: "lease failed again", reason: "lease-failed" });
      expect(flow.actions.deploy).toHaveBeenCalledTimes(2);
    });

    it("shows the failure right away when no other provider has bid", async () => {
      const { result, flow } = setup({ holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));

      expect(result.current.state).toEqual({ kind: "error", message: "lease failed", reason: "lease-failed" });
      expect(flow.actions.clearSelection).not.toHaveBeenCalled();
    });

    it("never recommends a provider a failed lease went to while the next one is still being matched", async () => {
      const { result, flow } = setup({
        ...withNextProvider(),
        holdDeploy: true,
        providerProxyRequest: probeProviders(() => new Promise(() => undefined))
      });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));

      await vi.waitFor(() => expect(result.current.recommendedBidIds).toEqual([NEXT_BID_ID]));
      expect(result.current.state.kind).toBe("matching");
    });

    it("does not count a closed bid as another provider to try", async () => {
      const { result, flow } = setup({ ...withNextProvider({ nextBidState: "closed" }), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));

      expect(result.current.state).toEqual({ kind: "error", message: "lease failed", reason: "lease-failed" });
      expect(flow.actions.clearSelection).not.toHaveBeenCalled();
    });

    it("does not move a resumed deployment's existing lease to another provider", async () => {
      const resumeLeases = [{ dseq: DSEQ, gseq: 1, oseq: 3, provider: PROVIDER_OWNER }];
      const { result, flow } = setup({ ...withNextProvider(), initialDseq: DSEQ, resumeLeases, holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));

      expect(result.current.state).toEqual({ kind: "error", message: "lease failed", reason: "lease-failed" });
      expect(flow.actions.clearSelection).not.toHaveBeenCalled();
    });

    it("keeps a lease the api has not ruled out landing with its provider, offering no other provider to pick", async () => {
      const { result, flow } = setup({ ...withNextProvider(), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("still being processed", false));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(result.current.state).toStrictEqual({ kind: "error", message: "still being processed", reason: undefined });
      expect(flow.actions.clearSelection).not.toHaveBeenCalled();
      expect(flow.actions.deploy).toHaveBeenCalledTimes(1);
    });

    it("does not retry a deploy that stopped before its lease was sent", async () => {
      const { result, flow } = setup({ ...withNextProvider(), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("patch failed"));
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(result.current.state).toStrictEqual({ kind: "error", message: "patch failed", reason: undefined });
      expect(flow.actions.clearSelection).not.toHaveBeenCalled();
    });

    it("matches from every bid again on a fresh attempt after tryAgain", async () => {
      const { result, flow } = setup({ ...withNextProvider(), holdDeploy: true });

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(1));
      act(() => flow.setDeployError("lease failed", true));
      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(2));
      act(() => flow.setDeployError("lease failed again", true));
      await vi.waitFor(() => expect(result.current.state.kind).toBe("error"));
      act(() => result.current.tryAgain());

      await vi.waitFor(() => expect(flow.actions.deploy).toHaveBeenCalledTimes(3));
      expect(flow.actions.selectProvider).toHaveBeenLastCalledWith(BID_ID, BID_ID);
    });

    function withNextProvider(input?: { nextBidState?: string; hasNextProviderRecord?: boolean }) {
      const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
      const nextProvider = mock<ApiProviderList>({ owner: NEXT_PROVIDER, hostUri: "https://next-provider.example" });
      const nextBid = mock<DeploymentBids[number]>({
        bid: { state: input?.nextBidState ?? "open", id: { provider: NEXT_PROVIDER, dseq: DSEQ, gseq: 1, oseq: 1 } }
      });
      const providers = input?.hasNextProviderRecord === false ? [provider] : [provider, nextProvider];
      return { providers, bids: [openBid(), nextBid] };
    }

    function probeProviders(probeNextProvider: () => Promise<unknown>) {
      return vi.fn((_path: string, options: { providerIdentity: { owner: string } }) =>
        options.providerIdentity.owner === NEXT_PROVIDER ? probeNextProvider() : Promise.resolve({ data: {} })
      );
    }
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

  it("looks up no provider before the deployment is quoting", () => {
    const { useProvidersByAddresses } = setup();

    expect(useProvidersByAddresses).toHaveBeenNthCalledWith(1, [], { enabled: false });
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

    it("recommends each placement's own bid, keeping the provider matched for one placement to that placement", async () => {
      const { providerA, providerB, bidA, bidB } = multiPlacement();
      const { result, flow } = setup({
        providers: [providerA, providerB],
        bids: [bidA, bidB],
        requiredGseqs: [1, 2],
        providerProxyRequest: vi.fn((_path: string, options: { providerIdentity: { owner: string } }) =>
          options.providerIdentity.owner === PROVIDER_B ? Promise.reject(new Error("unreachable")) : Promise.resolve({ data: {} })
        )
      });

      const bidAId = formatBidId({ provider: PROVIDER_A, dseq: DSEQ, gseq: 1, oseq: 1 });
      const bidBId = formatBidId({ provider: PROVIDER_B, dseq: DSEQ, gseq: 2, oseq: 1 });
      await vi.waitFor(() => expect(result.current.matchedProviderAddress).toBe(PROVIDER_A));
      expect(flow.actions.selectProvider).toHaveBeenCalledTimes(1);
      expect(result.current.recommendedBidIds).toEqual([bidAId, bidBId]);
    });

    it("looks up the providers of the open bids on the placement it is matching", async () => {
      const { providerA, providerB, bidA, bidB } = multiPlacement();
      const { useProvidersByAddresses } = setup({ initialDseq: DSEQ, providers: [providerA, providerB], bids: [bidA, bidB], requiredGseqs: [1, 2] });

      await vi.waitFor(() => expect(useProvidersByAddresses).toHaveBeenCalledWith([PROVIDER_A], { enabled: true }));
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
    vi.useRealTimers();
  });

  function openBid() {
    return mock<DeploymentBids[number]>({ bid: { state: "open", id: { provider: PROVIDER_OWNER, dseq: DSEQ, gseq: 1, oseq: 1 } } });
  }

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
    lateBidWaitMs?: number;
  }) {
    vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => undefined);

    const provider = mock<ApiProviderList>({ owner: PROVIDER_OWNER, hostUri: "https://provider.example" });
    const providers = input?.providers ?? [provider];
    const bids = input?.bids ?? [openBid()];

    const providerProxy = mock<ProviderProxyService>();
    if (input?.providerProxyRequest) {
      providerProxy.request.mockImplementation(input.providerProxyRequest as never);
    } else {
      providerProxy.request.mockResolvedValue({ data: {} } as never);
    }

    // Captures the action calls the autopilot makes and exposes hooks to simulate the underlying flow's terminal states.
    const actions = {
      requestQuotes: vi.fn(),
      requestQuotesAgain: vi.fn(),
      selectProvider: vi.fn(),
      deploy: vi.fn(),
      cancelAndEdit: vi.fn(),
      closeAndFail: vi.fn(),
      retryClose: vi.fn(),
      discard: vi.fn(),
      setBidStrategy: vi.fn(),
      refreshQuotes: vi.fn(),
      retry: vi.fn(),
      clearSelection: vi.fn()
    };

    const flowControls: {
      setPhaseError: (message?: string) => void;
      setFlowError: (error: FlowError) => void;
      setDeployError: (message?: string, canLeaseElsewhere?: boolean) => void;
      setCreating: () => void;
      dropSelections: () => void;
      replaceDseq: (next: string) => void;
      reportNoBids: () => void;
      receiveBids: (next: DeploymentBids) => void;
    } = {
      setPhaseError: () => undefined,
      setFlowError: () => undefined,
      setDeployError: () => undefined,
      setCreating: () => undefined,
      dropSelections: () => undefined,
      replaceDseq: () => undefined,
      reportNoBids: () => undefined,
      receiveBids: () => undefined
    };

    // A live, stateful stub of the base flow: it advances phase in response to the autopilot's action calls exactly as
    // the real `useDeploymentFlow` does, so the autopilot's effects fire against realistic transitions without the real
    // chain logic. Called inside the harness below and passed to the autopilot as its `flow` input.
    function useFlowStub({ intent }: { intent: { dseq?: string } }): DeploymentFlow {
      const [phase, setPhase] = useState<DeploymentFlow["phase"]>(intent.dseq ? "quoting" : "configuring");
      const [dseq, setDseq] = useState<string | null>(intent.dseq ?? DSEQ);
      const [selections, setSelections] = useState<Record<string, string>>({});
      const [deploySucceeded, setDeploySucceeded] = useState(false);
      const [deployError, setDeployError] = useState<DeployError | undefined>(undefined);
      const [error, setError] = useState<FlowError | undefined>(undefined);
      const [liveBids, setLiveBids] = useState(bids);
      const [noBidsReceived, setNoBidsReceived] = useState(false);

      flowControls.setPhaseError = (message?: string) => {
        setError({ message });
        setPhase("error");
      };
      flowControls.setFlowError = (flowError: FlowError) => {
        setError(flowError);
        setPhase("error");
      };
      flowControls.setDeployError = (message?: string, canLeaseElsewhere?: boolean) => {
        setDeployError({ message, canLeaseElsewhere });
        setPhase("quoting");
      };
      flowControls.setCreating = () => setPhase("creating");
      flowControls.dropSelections = () => setSelections({});
      flowControls.replaceDseq = (next: string) => setDseq(next);
      flowControls.reportNoBids = () => setNoBidsReceived(true);
      flowControls.receiveBids = (next: DeploymentBids) => {
        setLiveBids(next);
        setNoBidsReceived(false);
      };

      const requestQuotes = useCallback((sdl: string) => {
        actions.requestQuotes(sdl);
        setPhase("quoting");
      }, []);
      const selectProvider = useCallback((placementId: string, bidId: string) => {
        actions.selectProvider(placementId, bidId);
        setDeployError(undefined);
        setSelections(previous => ({ ...previous, [placementId]: bidId }));
      }, []);
      const clearSelection = useCallback((placementId: string) => {
        actions.clearSelection(placementId);
        setSelections(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => id !== placementId)));
      }, []);
      const deploy = useCallback((sdl: string, options?: DeployOptions) => {
        actions.deploy(sdl, options);
        setDeployError(undefined);
        if (input?.holdDeploy) return;
        setPhase("deploying");
        setDeploySucceeded(true);
      }, []);
      const closeAndFail = useCallback((message: string, kind?: AbandonedAttemptKind) => {
        actions.closeAndFail(message, kind);
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
        bids: phase === "quoting" ? liveBids : [],
        deploySucceeded,
        isDeployedInBackground: false,
        showsDeployProgress: false,
        isDeployTakingLong: false,
        noBidsReceived,
        deployError,
        error,
        pendingClose: null,
        isCreatingInBackground: false,
        isLeaseInFlight: false,
        autoLeasedDseq: null,
        recommendedBidIds: [],
        actions: { ...actions, requestQuotes, selectProvider, clearSelection, deploy, retry, cancelAndEdit, closeAndFail }
      };
    }

    const publicConsoleApiHttpClient = { get: vi.fn().mockResolvedValue({ data: providers }) };

    // `useProvidersByAddresses` is stubbed to hand back the candidate providers directly; the real `useFirstReachableProvider` runs
    // against the stubbed provider-proxy so reachability outcomes (reachable vs. unreachable) drive the autopilot for real.
    const useProvidersByAddresses = vi.fn((_addresses: readonly string[], _options?: { enabled?: boolean }) => ({
      data: providers,
      isLoading: false,
      isFetching: false
    }));

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
            useProvidersByAddresses,
            useFirstReachableProvider,
            useQuoteExpiry,
            getRequiredGseqs,
            matchDeadlineMs: input?.matchDeadlineMs ?? UNREACHED_DEADLINE_MS,
            lateBidWaitMs: input?.lateBidWaitMs ?? UNREACHED_DEADLINE_MS
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

    return { ...view, actions, flow: { actions, ...flowControls }, providerProxy, analyticsService, useProvidersByAddresses };
  }
});
