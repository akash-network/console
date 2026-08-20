import { describe, expect, it } from "vitest";

import { ReclaimingBadge } from "./ReclaimingBadge";

import { render, screen } from "@testing-library/react";

describe(ReclaimingBadge.name, () => {
  it("shows the reclaiming status for a lease in the reclamation grace period", () => {
    setup({ state: "reclaiming" });

    expect(screen.getByText("Reclaiming")).toBeInTheDocument();
  });

  it("renders nothing for a lease that is not reclaiming", () => {
    setup({ state: "active" });

    expect(screen.queryByText("Reclaiming")).not.toBeInTheDocument();
  });

  function setup(input: { state: string }) {
    return render(<ReclaimingBadge lease={{ state: input.state }} />);
  }
});
