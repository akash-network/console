import { describe, expect, it } from "vitest";

import { BalanceBreakdownBar, buildBalanceSegments } from "./BalanceBreakdownBar";
import type { ReservedDeployment } from "./useAccountBalanceOverview";

import { render, screen } from "@testing-library/react";

describe(buildBalanceSegments.name, () => {
  it("orders reserved deployments before the available segment", () => {
    const segments = buildBalanceSegments(deployments([100, 50]), 200);

    expect(segments.map(s => s.key)).toEqual(["dseq-0", "dseq-1", "available"]);
    expect(segments.map(s => s.amountUsd)).toEqual([100, 50, 200]);
  });

  it("colors the available segment with the success token", () => {
    const [available] = buildBalanceSegments([], 200);

    expect(available.key).toBe("available");
    expect(available.color).toBe("hsl(var(--success))");
  });

  it("gives the largest deployment the most opaque ramp step", () => {
    const segments = buildBalanceSegments(deployments([100, 50]), 0);

    expect(segments[0].color).toContain("0.9");
    expect(segments[1].color).not.toBe(segments[0].color);
  });

  it("drops zero-value segments", () => {
    expect(buildBalanceSegments(deployments([0]), 0)).toEqual([]);
  });

  it("carries each deployment's hourly rate onto its reserved segment but not the available one", () => {
    const segments = buildBalanceSegments(deployments([120]), 200);

    expect(segments[0].perHourUsd).toBe(1);
    expect(segments[1].perHourUsd).toBeUndefined();
  });

  function deployments(amounts: number[]): ReservedDeployment[] {
    return amounts.map((reservedUsd, index) => ({ dseq: `dseq-${index}`, name: `deployment-${index}`, reservedUsd, perHourUsd: reservedUsd / 120 }));
  }
});

describe(BalanceBreakdownBar.name, () => {
  it("renders one element per segment sized by flex-grow", () => {
    setup([
      { key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--primary) / 0.9)" },
      { key: "available", label: "Available", amountUsd: 300, color: "hsl(var(--success))" }
    ]);

    const bar = screen.getByRole("img");
    expect(bar.children).toHaveLength(2);
    expect((bar.children[0] as HTMLElement).style.flexGrow).toBe("100");
    expect((bar.children[1] as HTMLElement).style.flexGrow).toBe("300");
  });

  it("summarizes every segment in the aria-label", () => {
    setup([{ key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--primary))" }]);

    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("llama");
  });

  it("marks the auto top-up threshold when one is provided", () => {
    setup(
      [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      250
    );

    expect(screen.getByText(/Tops up at/)).toHaveTextContent("$250");
  });

  it("omits the threshold marker when no threshold is provided", () => {
    setup([{ key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }]);

    expect(screen.queryByText(/Tops up at/)).not.toBeInTheDocument();
  });

  it("positions the marker as the far-right slice of the bar", () => {
    setup(
      [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      250
    );

    expect(screen.getByTestId("balance-threshold-hatch").style.width).toBe("12.5%");
    expect(screen.getByTestId("balance-threshold-line").style.left).toBe("87.5%");
  });

  function setup(segments: Parameters<typeof BalanceBreakdownBar>[0]["segments"], threshold?: number | null) {
    return render(<BalanceBreakdownBar segments={segments} threshold={threshold} />);
  }
});
