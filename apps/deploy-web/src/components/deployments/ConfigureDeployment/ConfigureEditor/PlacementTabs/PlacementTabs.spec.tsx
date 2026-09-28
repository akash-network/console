import { describe, expect, it, vi } from "vitest";

import type { PlacementTab } from "./PlacementTabs";
import { PlacementTabs } from "./PlacementTabs";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(PlacementTabs.name, () => {
  it("shows a tab per placement with its configuration status and marks the active one", () => {
    setup({});

    const tabs = within(screen.getByRole("tablist", { name: "Placements" })).getAllByRole("tab");
    expect(tabs.map(tab => tab.textContent)).toEqual(["placement-1", "placement-2"]);
    expect(within(tabs[0]).getByRole("img", { name: "Complete" })).toBeInTheDocument();
    expect(within(tabs[1]).getByRole("img", { name: "Incomplete" })).toBeInTheDocument();
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("selects a placement when its tab is clicked", async () => {
    const { onSelectPlacement } = setup({});

    await userEvent.click(screen.getByRole("tab", { name: /placement-2/ }));

    expect(onSelectPlacement).toHaveBeenCalledWith("p2");
  });

  it("waits for a key press before switching placements from the keyboard", async () => {
    const { onSelectPlacement } = setup({});
    screen.getByRole("tab", { name: /placement-1/ }).focus();

    await userEvent.keyboard("{ArrowRight}");

    expect(onSelectPlacement).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: /placement-2/ })).toHaveFocus();
  });

  it("shows the active placement's content", () => {
    setup({});

    expect(screen.getByRole("tabpanel")).toHaveTextContent("placement content");
  });

  it("marks a placement whose settings have errors", () => {
    setup({ placements: [tab({ id: "p1", name: "placement-1", hasError: true })] });

    expect(screen.getByRole("tab", { name: /placement-1/ })).toHaveClass("text-destructive");
  });

  it("removes the active placement", async () => {
    const { onRemovePlacement } = setup({ activePlacementId: "p2" });

    await userEvent.click(screen.getByRole("button", { name: "Remove placement-2" }));

    expect(onRemovePlacement).toHaveBeenCalledWith("p2");
  });

  it("offers no removal for the only placement or while locked", () => {
    setup({ canRemove: false });

    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
  });

  it("adds a placement", async () => {
    const { onAddPlacement } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Add placement" }));

    expect(onAddPlacement).toHaveBeenCalled();
  });

  it("keeps placements selectable but not addable while locked", () => {
    setup({ locked: true });

    expect(screen.getByRole("button", { name: "Add placement" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: /placement-2/ })).toBeEnabled();
  });

  function setup(input: { placements?: PlacementTab[]; activePlacementId?: string; canRemove?: boolean; locked?: boolean }) {
    const onSelectPlacement = vi.fn();
    const onRemovePlacement = vi.fn();
    const onAddPlacement = vi.fn();
    render(
      <PlacementTabs
        placements={input.placements ?? [tab({ id: "p1", name: "placement-1", status: "complete" }), tab({ id: "p2", name: "placement-2" })]}
        activePlacementId={input.activePlacementId ?? "p1"}
        onSelectPlacement={onSelectPlacement}
        canRemove={input.canRemove ?? true}
        onRemovePlacement={onRemovePlacement}
        onAddPlacement={onAddPlacement}
        locked={input.locked}
      >
        placement content
      </PlacementTabs>
    );
    return { onSelectPlacement, onRemovePlacement, onAddPlacement };
  }

  function tab(overrides: Partial<PlacementTab> & Pick<PlacementTab, "id" | "name">): PlacementTab {
    return { status: "incomplete", hasError: false, ...overrides };
  }
});
