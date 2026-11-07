import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { NO_BIDS_TIMEOUT_MS } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { BID_POLL_INTERVAL } from "@src/queries/useListBids";
import type { DEPENDENCIES } from "./NoBidsYetNotice";
import { NoBidsYetNotice, whyNoBidsQuestionOf } from "./NoBidsYetNotice";

import { act, fireEvent, render, screen } from "@testing-library/react";

type BidsQuery = ReturnType<typeof DEPENDENCIES.useListBids>;
type BidEntry = NonNullable<BidsQuery["data"]>["data"][number];

describe(NoBidsYetNotice.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays quiet while the bid window is open, polling for bids", () => {
    const { useListBids } = setup({ bids: [] });

    act(() => vi.advanceTimersByTime(NO_BIDS_TIMEOUT_MS - 1));

    expect(screen.queryByText("No bids yet")).not.toBeInTheDocument();
    expect(useListBids).toHaveBeenLastCalledWith("1234", { refetchInterval: BID_POLL_INTERVAL });
  });

  it("says no bids arrived once the window ends, and stops polling", () => {
    const { useListBids } = setup({ bids: [] });

    act(() => vi.advanceTimersByTime(NO_BIDS_TIMEOUT_MS));

    expect(screen.getByRole("status")).toHaveTextContent("No bids yet");
    expect(screen.getByRole("status")).toHaveTextContent("No provider has bid on llama-chat in the usual bid window. A late bid still starts it.");
    expect(useListBids).toHaveBeenLastCalledWith("1234", { refetchInterval: undefined });
  });

  it("asks the assistant why the deployment got no bids", () => {
    const { continueConversation } = setup({ bids: [] });
    act(() => vi.advanceTimersByTime(NO_BIDS_TIMEOUT_MS));

    fireEvent.click(screen.getByRole("button", { name: "Why no bids?" }));

    expect(continueConversation).toHaveBeenCalledWith("Why isn't my new deployment llama-chat getting any bids?");
    expect(whyNoBidsQuestionOf("llama-chat")).toBe("Why isn't my new deployment llama-chat getting any bids?");
  });

  it("offers no question without a conversation to continue", () => {
    setup({ bids: [], withoutConversation: true });

    act(() => vi.advanceTimersByTime(NO_BIDS_TIMEOUT_MS));

    expect(screen.getByText("No bids yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Why no bids?" })).not.toBeInTheDocument();
  });

  it.each([
    ["a bid arrived", [mock<BidEntry>()]],
    ["bids have not loaded", undefined]
  ])("stays quiet when %s", (_, bids) => {
    setup({ bids });

    act(() => vi.advanceTimersByTime(NO_BIDS_TIMEOUT_MS));

    expect(screen.queryByText("No bids yet")).not.toBeInTheDocument();
  });

  it("stops its timer when it goes away", () => {
    const { unmount } = setup({ bids: [] });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  function setup(input: { bids: BidEntry[] | undefined; withoutConversation?: boolean }) {
    vi.useFakeTimers();
    const continueConversation = vi.fn();
    const useListBids = vi.fn<typeof DEPENDENCIES.useListBids>(() => mock<BidsQuery>({ data: input.bids ? { data: input.bids } : undefined }));
    const { unmount } = render(
      <NoBidsYetNotice dseq="1234" name="llama-chat" continueConversation={input.withoutConversation ? undefined : continueConversation} dependencies={{ useListBids }} />
    );

    return { continueConversation, useListBids, unmount };
  }
});
