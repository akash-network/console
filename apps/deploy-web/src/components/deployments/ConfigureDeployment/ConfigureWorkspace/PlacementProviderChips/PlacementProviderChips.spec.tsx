import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { ReviewRow } from "../../ReviewAndDeployModal/useReviewRows";
import type { DEPENDENCIES } from "./PlacementProviderChips";
import { PlacementProviderChips } from "./PlacementProviderChips";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementProviderChips.name, () => {
  it("lists every placement with the provider picked for it", () => {
    setup({ rows: [row("p1", "provider.example")] });

    const chips = within(screen.getByRole("list", { name: "Placements" })).getAllByRole("button");
    expect(chips.map(chip => chip.textContent)).toEqual(["web· provider.example", "db"]);
  });

  it("checks off only the placements that have a provider", () => {
    setup({ rows: [row("p1", "provider.example")] });

    expect(screen.getByRole("button", { name: /^web/ }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^db/ }).querySelector("svg")).not.toBeInTheDocument();
  });

  it("marks the placement a provider is being picked for", () => {
    setup({ activePlacementId: "p2" });

    expect(screen.getByRole("button", { name: /^db/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^web/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("counts how many placements have a provider", () => {
    setup({ rows: [row("p1", "provider.example")] });

    expect(screen.getByText("1/2 assigned")).toBeInTheDocument();
  });

  it("moves to a placement when its chip is clicked", async () => {
    const { onSelectPlacement } = setup({});

    await userEvent.click(screen.getByRole("button", { name: /^db/ }));

    expect(onSelectPlacement).toHaveBeenCalledWith("p2");
  });

  it("looks the picked providers up for the deployment's selections", () => {
    const { useReviewRows, placements } = setup({ selections: { p1: "akash1a/1/1/1" } });

    expect(useReviewRows).toHaveBeenCalledWith({ dseq: "42", placements, selections: { p1: "akash1a/1/1/1" } });
  });

  function setup(input: { rows?: ReviewRow[]; activePlacementId?: string; selections?: Record<string, string> }) {
    const placements = [mock<PlacementType>({ id: "p1", name: "web" }), mock<PlacementType>({ id: "p2", name: "db" })];
    const onSelectPlacement = vi.fn();
    const useReviewRows = vi.fn(() => ({ rows: input.rows ?? [], pricedCount: 0, totalCount: placements.length }));
    const dependencies: typeof DEPENDENCIES = { useReviewRows };

    render(
      <PlacementProviderChips
        dseq="42"
        placements={placements}
        selections={input.selections ?? {}}
        activePlacementId={input.activePlacementId ?? "p1"}
        onSelectPlacement={onSelectPlacement}
        dependencies={dependencies}
      />
    );

    return { onSelectPlacement, useReviewRows, placements };
  }

  function row(placementId: string, providerName: string): ReviewRow {
    return { placementId, placementName: placementId, providerName };
  }
});
