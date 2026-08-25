import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";

import { BalanceBreakdownBar, buildBalanceSegments, THRESHOLD_HATCH_BACKGROUND } from "./BalanceBreakdownBar";
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

  it("shades visible segments the same regardless of drained deployments in the list", () => {
    const withDrained = buildBalanceSegments(deployments([100, 50, 0]), 0);
    const withoutDrained = buildBalanceSegments(deployments([100, 50]), 0);

    expect(withDrained.map(s => s.color)).toEqual(withoutDrained.map(s => s.color));
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
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--primary) / 0.9)" },
        { key: "available", label: "Available", amountUsd: 300, color: "hsl(var(--success))" }
      ]
    });

    const bar = screen.getByRole("img");
    expect(bar.children).toHaveLength(2);
    expect((bar.children[0] as HTMLElement).style.flexGrow).toBe("100");
    expect((bar.children[1] as HTMLElement).style.flexGrow).toBe("300");
  });

  it("summarizes every segment in the aria-label", () => {
    setup({ segments: [{ key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--primary))" }] });

    expect(screen.getByRole("img").getAttribute("aria-label")).toContain("llama");
  });

  it("marks the auto top-up threshold when one is provided", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    expect(screen.getByTestId("balance-threshold-hatch")).toBeInTheDocument();
    expect(screen.getByTestId("balance-threshold-line")).toBeInTheDocument();
  });

  it("omits the threshold marker when no threshold is provided", () => {
    setup({ segments: [{ key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }] });

    expect(screen.queryByTestId("balance-threshold-hatch")).not.toBeInTheDocument();
    expect(screen.queryByTestId("balance-threshold-line")).not.toBeInTheDocument();
  });

  it("anchors the hatch to the start of the available segment", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    const hatch = screen.getByTestId("balance-threshold-hatch");
    expect(hatch.style.width).toBe("25%");
    expect(hatch.parentElement).toHaveAttribute("title", "Available: $1,000.00");
    expect(screen.getByTestId("balance-threshold-line").style.left).toBe("25%");
    expect(screen.getByRole("img").children).toHaveLength(2);
  });

  it("covers the whole available segment and hides the line when available is at or below the threshold", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 200, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    expect(screen.getByTestId("balance-threshold-hatch").style.width).toBe("100%");
    expect(screen.queryByTestId("balance-threshold-line")).not.toBeInTheDocument();
  });

  it("paints the hatch with the theme background token so it stays green and white/dark", () => {
    expect(THRESHOLD_HATCH_BACKGROUND).toContain("var(--background)");
  });

  function setup(input: { segments: Parameters<typeof BalanceBreakdownBar>[0]["segments"]; threshold?: number | null }) {
    return render(
      <IntlProvider locale="en-US">
        <BalanceBreakdownBar segments={input.segments} threshold={input.threshold} />
      </IntlProvider>
    );
  }
});
