import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LeaseDto } from "@src/types/deployment";
import { ReclamationCountdown } from "./ReclamationCountdown";

import { render, screen } from "@testing-library/react";

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

  it("renders nothing for a deployment that is not being reclaimed", () => {
    const { container } = setup([mock<LeaseDto>({ state: "active" })]);

    expect(container).toBeEmptyDOMElement();
  });

  function setup(leases: LeaseDto[]) {
    return render(<ReclamationCountdown leases={leases} />);
  }
});
