import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";

import { BalanceBreakdownBar, buildBalanceSegments } from "./BalanceBreakdownBar";
import type { EscrowedDeployment } from "./useAccountBalanceOverview";

import { fireEvent, render, screen } from "@testing-library/react";

describe(buildBalanceSegments.name, () => {
  it("orders escrowed deployments before the available segment", () => {
    const segments = buildBalanceSegments(deployments([100, 50]), 200);

    expect(segments.map(s => s.key)).toEqual(["dseq-0", "dseq-1", "available"]);
    expect(segments.map(s => s.amountUsd)).toEqual([100, 50, 200]);
  });

  it("colors the available segment with the success token", () => {
    const [available] = buildBalanceSegments([], 200);

    expect(available.key).toBe("available");
    expect(available.color).toBe("hsl(var(--success))");
  });

  it("colors every escrowed deployment with the foreground token", () => {
    const segments = buildBalanceSegments(deployments([100, 50]), 0);

    expect(segments.map(s => s.color)).toEqual(["hsl(var(--foreground))", "hsl(var(--foreground))"]);
  });

  it("drops zero-value segments", () => {
    expect(buildBalanceSegments(deployments([0, 40]), 0).map(s => s.key)).toEqual(["dseq-1"]);
  });

  it("carries each deployment's hourly rate onto its escrow segment but not the available one", () => {
    const segments = buildBalanceSegments(deployments([120]), 200);

    expect(segments[0].perHourUsd).toBe(1);
    expect(segments[1].perHourUsd).toBeUndefined();
  });

  function deployments(amounts: number[]): EscrowedDeployment[] {
    return amounts.map((escrowUsd, index) => ({ dseq: `dseq-${index}`, name: `deployment-${index}`, escrowUsd, perHourUsd: escrowUsd / 120 }));
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
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 300, color: "hsl(var(--success))" }
      ]
    });

    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Balance breakdown: llama $100.00, Available $300.00");
  });

  it("draws an empty track when there are no funds to show", () => {
    setup({ segments: [] });

    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Balance breakdown: no funds");
    expect(screen.getByTestId("balance-empty-track")).toBeInTheDocument();
  });

  it("leaves the track out once a segment fills the bar", () => {
    setup({ segments: [{ key: "available", label: "Available", amountUsd: 1, color: "hsl(var(--success))" }] });

    expect(screen.queryByTestId("balance-empty-track")).not.toBeInTheDocument();
  });

  it("dims every segment except the hovered one", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--foreground))" },
        { key: "available", label: "Available", amountUsd: 300, color: "hsl(var(--success))" }
      ],
      hoveredKey: "d1"
    });

    const [hovered, other] = Array.from(screen.getByRole("img").children) as HTMLElement[];
    expect(hovered.style.opacity).toBe("1");
    expect(other.style.opacity).toBe("0.18");
  });

  it("reports hovers on a segment and clears them on leave", () => {
    const onHover = vi.fn();
    setup({ segments: [{ key: "d1", label: "llama", amountUsd: 100, color: "hsl(var(--foreground))" }], onHover });

    fireEvent.mouseEnter(screen.getByTitle("llama: $100.00"));
    fireEvent.mouseLeave(screen.getByTitle("llama: $100.00"));

    expect(onHover.mock.calls).toEqual([["d1"], [null]]);
  });

  it("marks the auto top-up threshold when one is provided", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    expect(screen.getByTestId("balance-threshold-line")).toBeInTheDocument();
    expect(screen.getByTestId("balance-threshold-caption")).toHaveTextContent("Tops up at $250.00");
  });

  it("omits the threshold marker when no threshold is provided", () => {
    setup({ segments: [{ key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }] });

    expect(screen.queryByTestId("balance-threshold-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("balance-threshold-caption")).not.toBeInTheDocument();
  });

  it("places the marker a threshold's worth into the available segment", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    const line = screen.getByTestId("balance-threshold-line");
    expect(line.style.left).toBe("25%");
    expect(line.parentElement).toHaveAttribute("title", "Available: $1,000.00");
    expect(screen.getByTestId("balance-threshold-caption").style.left).toBe("25%");
    expect(screen.getByRole("img").children).toHaveLength(2);
  });

  it("keeps the threshold line but drops the caption when the host hides it", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 1000, color: "hsl(var(--success))" }
      ],
      threshold: 250,
      hideThresholdCaption: true
    });

    expect(screen.getByTestId("balance-threshold-line")).toBeInTheDocument();
    expect(screen.queryByTestId("balance-threshold-caption")).not.toBeInTheDocument();
  });

  it("drops the marker when available is at or below the threshold", () => {
    setup({
      segments: [
        { key: "d1", label: "llama", amountUsd: 1000, color: "hsl(var(--primary))" },
        { key: "available", label: "Available", amountUsd: 200, color: "hsl(var(--success))" }
      ],
      threshold: 250
    });

    expect(screen.queryByTestId("balance-threshold-line")).not.toBeInTheDocument();
    expect(screen.queryByTestId("balance-threshold-caption")).not.toBeInTheDocument();
  });

  function setup(input: {
    segments: Parameters<typeof BalanceBreakdownBar>[0]["segments"];
    threshold?: number | null;
    hideThresholdCaption?: boolean;
    hoveredKey?: string | null;
    onHover?: (key: string | null) => void;
  }) {
    return render(
      <IntlProvider locale="en-US">
        <BalanceBreakdownBar
          segments={input.segments}
          threshold={input.threshold}
          hideThresholdCaption={input.hideThresholdCaption}
          hoveredKey={input.hoveredKey}
          onHover={input.onHover}
        />
      </IntlProvider>
    );
  }
});
