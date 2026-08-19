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

    await waitFor(() => expect(get).toHaveBeenCalledWith(expect.stringContaining("/v1/blockchain-status")));
    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
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

  it("stops polling once unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { get, unmount } = setup({ isBlockchainReachable: true });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    unmount();
    await vi.advanceTimersByTimeAsync(15 * 60_000);

    expect(get).toHaveBeenCalledTimes(1);
  });

  function setup(input?: { isBlockchainReachable?: boolean; failStatus?: boolean }) {
    const get = vi.fn(async () => {
      if (input?.failStatus) throw new Error("network error");
      return { data: { isBlockchainReachable: input?.isBlockchainReachable ?? true } };
    });

    const useRootContainer: typeof DEPENDENCIES.useRootContainer = () =>
      mock<RootContainer>({
        publicConsoleApiHttpClient: mock<RootContainer["publicConsoleApiHttpClient"]>({ get } as unknown as RootContainer["publicConsoleApiHttpClient"])
      });

    const { unmount } = render(
      <BlockchainStatusProvider dependencies={{ ...DEPENDENCIES, useRootContainer }}>
        <TestConsumer />
      </BlockchainStatusProvider>
    );

    return { get, unmount };
  }
});

describe(useBlockchainStatus.name, () => {
  it("defaults to the chain being up when no provider is mounted", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("is-blockchain-down")).toHaveTextContent("false");
  });
});

function TestConsumer() {
  const { isBlockchainDown } = useBlockchainStatus();
  return <span data-testid="is-blockchain-down">{String(isBlockchainDown)}</span>;
}
