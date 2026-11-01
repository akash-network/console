import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { RootContainer } from "../ServicesProvider/ServicesContext";
import { BlockchainStatusProvider, DEPENDENCIES, useBlockchainStatus } from "./BlockchainStatusProvider";

import { render, screen, waitFor } from "@testing-library/react";

describe(BlockchainStatusProvider.name, () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports the chain as up while the status endpoint says it is reachable", async () => {
    const { get } = setup({ isBlockchainReachable: true });

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("/v1/blockchain-status"), expect.anything()));
    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
  });

  it("reports the chain as up, at no known height, until the first status answer arrives", async () => {
    const { get } = setup({ isStatusPending: true });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
    expect(screen.getByTestId("latest-block")).toHaveTextContent("none");
  });

  it("reports the chain as down when the status endpoint says it is unreachable", async () => {
    setup({ isBlockchainReachable: false });

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
  });

  it("reports the chain as down when the status request fails", async () => {
    setup({ failStatus: true });

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
  });

  it("recovers once a later poll reports the chain reachable again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { get } = setup({ isBlockchainReachable: false });

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));

    get.mockResolvedValue({ data: { isBlockchainReachable: true } });
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false"));
  });

  it("shares the latest height the status endpoint reported and when it arrived", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-10-31T12:00:00Z") });
    setup({ isBlockchainReachable: true, latestBlockHeight: 1234 });

    await waitFor(() => expect(screen.getByTestId("latest-block")).toHaveTextContent(`1234@${new Date("2026-10-31T12:00:00Z").getTime()}`));
  });

  it("keeps the last height it saw while the status endpoint reports none", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { get } = setup({ isBlockchainReachable: true, latestBlockHeight: 1234 });

    await waitFor(() => expect(screen.getByTestId("latest-block")).toHaveTextContent(/^1234@/));

    get.mockResolvedValue({ data: { isBlockchainReachable: false, latestBlockHeight: null } });
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
    expect(screen.getByTestId("latest-block")).toHaveTextContent(/^1234@/);
  });

  it("keeps the last height it saw when the status request fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { get } = setup({ isBlockchainReachable: true, latestBlockHeight: 1234 });

    await waitFor(() => expect(screen.getByTestId("latest-block")).toHaveTextContent(/^1234@/));

    get.mockRejectedValue(new Error("network error"));
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    await waitFor(() => expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("true"));
    expect(screen.getByTestId("latest-block")).toHaveTextContent(/^1234@/);
  });

  it("bounds the status request with a finite timeout so a stalled poll cannot park the loop", async () => {
    const { get } = setup({ isBlockchainReachable: true });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    const [, config] = get.mock.calls[0];
    expect(Number.isFinite(config?.timeout)).toBe(true);
    expect(config?.timeout).toBeGreaterThan(0);
  });

  it("stops polling once unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { get, unmount } = setup({ isBlockchainReachable: true });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    unmount();
    await vi.advanceTimersByTimeAsync(15 * 60_000);

    expect(get).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { isBlockchainReachable?: boolean; latestBlockHeight?: number; failStatus?: boolean; isStatusPending?: boolean }) {
    const get = vi.fn<(url: string, config?: { timeout?: number }) => Promise<{ data: { isBlockchainReachable: boolean; latestBlockHeight?: number | null } }>>(
      async () => {
        if (input?.isStatusPending) return new Promise<never>(() => {});
        if (input?.failStatus) throw new Error("network error");
        return { data: { isBlockchainReachable: input?.isBlockchainReachable ?? true, latestBlockHeight: input?.latestBlockHeight } };
      }
    );

    const rootContainer = mock<RootContainer>({
      publicConsoleApiHttpClient: mock<RootContainer["publicConsoleApiHttpClient"]>({ get } as unknown as RootContainer["publicConsoleApiHttpClient"])
    });
    const useRootContainer: typeof DEPENDENCIES.useRootContainer = () => rootContainer;

    const { unmount } = render(
      <BlockchainStatusProvider dependencies={{ ...DEPENDENCIES, useRootContainer }}>
        <TestConsumer />
      </BlockchainStatusProvider>
    );

    return { get, unmount };
  }
});

describe(useBlockchainStatus.name, () => {
  it("defaults to the chain being up, at no known height, when no provider is mounted", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
    expect(screen.getByTestId("latest-block")).toHaveTextContent("none");
  });
});

function TestConsumer() {
  const { isBlockchainDown, latestBlock } = useBlockchainStatus();
  return (
    <>
      <span data-testid="is-blockchain-down">{String(isBlockchainDown)}</span>
      <span data-testid="latest-block">{latestBlock ? `${latestBlock.height}@${latestBlock.observedAt}` : "none"}</span>
    </>
  );
}
