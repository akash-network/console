import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";
import type { QuoteExpiry } from "../../useQuoteExpiry/useQuoteExpiry";
import type { DEPENDENCIES } from "./BidWindowToast";
import { BidWindowToast } from "./BidWindowToast";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(BidWindowToast.name, () => {
  it("stays out of the way while the deployment is configured", () => {
    setup({ phase: "configuring" });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("collects bids while the deployment is created", () => {
    setup({ phase: "creating" });

    expect(screen.getByRole("status")).toHaveTextContent("Collecting bids…Bids stay open for about 5 minutes, so pick your providers before they expire.");
  });

  it("names the placements still waiting for a bid", () => {
    setup({ placementNames: ["web", "db", "cache"], placementsWithBids: ["p1"] });

    expect(screen.getByRole("status")).toHaveTextContent("Collecting bids…Waiting on db, cache.");
  });

  it("reports the bids collected with the time left, kept out of the announcements", () => {
    setup({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 165, isExpired: false } });

    expect(screen.getByRole("status")).toHaveTextContent("Bids collected");
    expect(screen.getByText("2:45")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("2:45")).toHaveClass("text-muted-foreground");
  });

  it("turns the countdown red in the last minute", () => {
    setup({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 42, isExpired: false } });

    expect(screen.getByText("0:42")).toHaveClass("text-destructive");
  });

  it("keeps the countdown muted until its last minute starts", () => {
    setup({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 60, isExpired: false } });

    expect(screen.getByText("1:00")).toHaveClass("tabular-nums", "text-muted-foreground");
  });

  it.each<[string, Parameters<typeof setup>[0], string]>([
    ["spins while bids are collected", { phase: "creating" }, "animate-spin"],
    ["checks off the bids once collected", { placementsWithBids: ["p1", "p2"] }, "text-green-600"],
    ["alerts once the bids expired", { placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 0, isExpired: true } }, "text-destructive"]
  ])("%s", (_, input, iconClass) => {
    const { container } = setup(input);

    expect(container.querySelector(`svg.${iconClass}`)).toBeInTheDocument();
  });

  it("keeps the bids collected once every placement had one, even as open bids drop off", () => {
    const { rerender } = setup({ placementsWithBids: ["p1", "p2"] });

    rerender({ placementsWithBids: ["p1"] });

    expect(screen.getByRole("status")).toHaveTextContent("Bids collected");
  });

  it("reports expired bids without a countdown", () => {
    setup({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 0, isExpired: true } });

    expect(screen.getByRole("status")).toHaveTextContent("Bids expiredClose and edit to request new ones.");
    expect(screen.queryByText("0:00")).not.toBeInTheDocument();
  });

  it("stays dismissed until the bid window changes state", async () => {
    const { rerender } = setup({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 100, isExpired: false } });

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender({ placementsWithBids: ["p1", "p2"], expiry: { secondsLeft: 0, isExpired: true } });

    expect(screen.getByRole("status")).toHaveTextContent("Bids expired");
  });

  it("watches the bids of the deployment's placements while quoting", () => {
    const { usePlacementsWithBids, placements } = setup({});

    expect(usePlacementsWithBids).toHaveBeenCalledWith({ enabled: true, dseq: "42", sdl: "the-sdl", placements });
  });

  it("doesn't watch the bids before the deployment is quoting", () => {
    const { usePlacementsWithBids } = setup({ phase: "creating" });

    expect(usePlacementsWithBids).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("disappears once the wait for a first bid ran out with none", () => {
    setup({ noBidsReceived: true });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  function setup(input: {
    phase?: DeploymentFlowPhase;
    placementNames?: string[];
    placementsWithBids?: string[];
    expiry?: QuoteExpiry | null;
    noBidsReceived?: boolean;
  }) {
    const placements = (input.placementNames ?? ["web", "db"]).map((name, index) => mock<PlacementType>({ id: `p${index + 1}`, name }));
    let withBids = new Set(input.placementsWithBids ?? []);
    const usePlacementsWithBids = vi.fn(() => withBids);
    const dependencies: typeof DEPENDENCIES = { usePlacementsWithBids };
    const toast = (overrides: { placementsWithBids?: string[]; expiry?: QuoteExpiry | null }) => (
      <BidWindowToast
        phase={input.phase ?? "quoting"}
        dseq="42"
        sdl="the-sdl"
        placements={placements}
        expiry={overrides.expiry === undefined ? input.expiry ?? null : overrides.expiry}
        noBidsReceived={input.noBidsReceived ?? false}
        dependencies={dependencies}
      />
    );
    const rendered = render(toast({}));

    return {
      usePlacementsWithBids,
      placements,
      container: rendered.container,
      rerender: (overrides: { placementsWithBids?: string[]; expiry?: QuoteExpiry | null }) => {
        withBids = new Set(overrides.placementsWithBids ?? []);
        rendered.rerender(toast(overrides));
      }
    };
  }
});
