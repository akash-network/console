import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { ReclamationCountdown } from "./ReclamationCountdown";

import { act, render, screen } from "@testing-library/react";

describe("ReclamationCountdown", () => {
  it("says how long a reclaimed workload has left", () => {
    const deadlineInOneDay = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    setup([mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: deadlineInOneDay } })]);

    expect(screen.getByText("reclaims in 24 hours")).toBeInTheDocument();
  });

  it("says reclamation is pending when the chain has not published a deadline", () => {
    setup([mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: 0 } })]);

    expect(screen.getByText("reclamation pending")).toBeInTheDocument();
  });

  it("counts down even when only one of several placements is being reclaimed", () => {
    const deadlineInOneDay = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    setup([mock<LeaseDto>({ state: "active" }), mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: deadlineInOneDay } })]);

    expect(screen.getByText("reclaims in 24 hours")).toBeInTheDocument();
  });

  it("counts down to the soonest deadline when several placements are being reclaimed", () => {
    const now = Math.floor(Date.now() / 1000);
    setup([
      mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: now + 48 * 60 * 60 } }),
      mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: now + 24 * 60 * 60 } })
    ]);

    expect(screen.getByText("reclaims in 24 hours")).toBeInTheDocument();
  });

  it("keeps counting down while the list is left open", () => {
    withClockAt("2026-09-12T00:00:00.000Z", now => {
      setup([reclaimingIn(now, 90)]);

      expect(screen.getByText("reclaims in 2 minutes")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(60_000));

      expect(screen.getByText("reclaims in 30 seconds")).toBeInTheDocument();
    });
  });

  it("stops promising time that has already run out", () => {
    withClockAt("2026-09-12T00:00:00.000Z", now => {
      setup([reclaimingIn(now, 10)]);

      act(() => vi.advanceTimersByTime(11_000));

      expect(screen.getByText("closing now…")).toBeInTheDocument();
    });
  });

  it("renders nothing for a deployment that is not being reclaimed", () => {
    const { container } = setup([mock<LeaseDto>({ state: "active" })]);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a deployment whose leases have not loaded", () => {
    const { container } = render(<ReclamationCountdown leases={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  function setup(leases: LeaseDto[]) {
    return render(<ReclamationCountdown leases={leases} />);
  }

  function reclaimingIn(now: number, seconds: number) {
    return mock<LeaseDto>({ state: "reclaiming", reclamation: { deadline: now / 1000 + seconds } });
  }

  function withClockAt(instant: string, assert: (now: number) => void) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instant));
    try {
      assert(Date.now());
    } finally {
      vi.useRealTimers();
    }
  }
});
