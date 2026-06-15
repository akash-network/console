import { TooltipProvider } from "@akashnetwork/ui/components";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BidCountdownTimer } from "./BidCountdownTimer";

import { render, screen } from "@testing-library/react";

describe(BidCountdownTimer.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the remaining time derived from the dseq timestamp", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const dseq = createdAgo(now, 60); // created 1 minute ago

    setup({ dseq });

    // 5min window - 60s elapsed + 20s buffer = 260s => 04:20
    expect(screen.getByText("Time Remaining: 04:20")).toBeInTheDocument();
  });

  it("renders 'Time's up!' once the 5 minute bid window has elapsed", () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const dseq = createdAgo(now, 6 * 60); // created 6 minutes ago

    setup({ dseq });

    expect(screen.getByText("Time's up!")).toBeInTheDocument();
  });

  it("renders nothing when dseq is null", () => {
    setup({ dseq: null });

    expect(screen.queryByText(/Time Remaining/)).not.toBeInTheDocument();
    expect(screen.queryByText("Time's up!")).not.toBeInTheDocument();
  });

  function createdAgo(now: Date, seconds: number) {
    return (now.getTime() - seconds * 1000).toString();
  }

  function setup(input: { dseq: string | null }) {
    return render(
      <TooltipProvider>
        <BidCountdownTimer dseq={input.dseq} />
      </TooltipProvider>
    );
  }
});
