import { describe, expect, it, vi } from "vitest";

import { CollapsibleCard } from "./collapsible-card";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(CollapsibleCard.name, () => {
  it("renders the title, icon, and body when expanded", () => {
    setup({});

    expect(screen.getByText("GPU")).toBeInTheDocument();
    expect(screen.getByText("card body")).toBeVisible();
  });

  it("renders a lock indicator in the header when locked", () => {
    setup({ locked: true });

    expect(screen.getByLabelText("Locked")).toBeInTheDocument();
  });

  it("does not render a lock indicator when not locked", () => {
    setup({});

    expect(screen.queryByLabelText("Locked")).not.toBeInTheDocument();
  });

  it("hides the body and shows the summary when collapsed", async () => {
    setup({ summary: "1 GPU" });

    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));

    expect(screen.getByText("1 GPU")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand GPU" })).toBeInTheDocument();
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("does not show the summary while expanded", () => {
    setup({ summary: "1 GPU" });

    expect(screen.queryByText("1 GPU")).not.toBeInTheDocument();
  });

  it("toggles when the title is clicked, not only the chevron", async () => {
    setup({});

    await userEvent.click(screen.getByText("GPU"));

    expect(screen.getByRole("button", { name: "Expand GPU" })).toBeInTheDocument();
  });

  it("renders an info icon with tooltip content when infoTooltip is provided", async () => {
    setup({ infoTooltip: <span>helpful info</span> });

    await userEvent.click(screen.getByLabelText("More information"));

    expect(screen.getAllByText("helpful info").length).toBeGreaterThan(0);
  });

  it("does not collapse when the info icon is clicked", async () => {
    setup({ infoTooltip: "helpful info" });

    await userEvent.click(screen.getByLabelText("More information"));

    expect(screen.getByRole("button", { name: "Collapse GPU" })).toBeInTheDocument();
  });

  it("does not render an info icon when infoTooltip is omitted", () => {
    setup({});

    expect(screen.queryByLabelText("More information")).not.toBeInTheDocument();
  });

  it("renders the header control", () => {
    setup({ headerControl: <button type="button">toggle</button> });

    expect(screen.getByRole("button", { name: "toggle" })).toBeInTheDocument();
  });

  it("does not collapse when the header control is clicked", async () => {
    const onControlClick = vi.fn();
    setup({
      headerControl: (
        <button type="button" onClick={onControlClick}>
          toggle
        </button>
      )
    });

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));

    expect(onControlClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Collapse GPU" })).toBeInTheDocument();
  });

  it("renders a disabled toggle card as collapsed with the chevron visible", () => {
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU" });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Expand GPU" })).toBeInTheDocument();
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("enables when the chevron is clicked while disabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU", onToggle });

    await userEvent.click(screen.getByRole("button", { name: "Expand GPU" }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("enables when the switch is turned on while disabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU", onToggle });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("only collapses, leaving the switch enabled, when the chevron is clicked while expanded", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", onToggle });

    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeChecked();
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("disables and collapses when the switch is turned off while enabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", onToggle });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));

    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("shows the collapse trigger and the body while toggled on", () => {
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU" });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Collapse GPU" })).toBeInTheDocument();
    expect(screen.getByText("card body")).toBeVisible();
  });

  it("re-expands the body when re-enabled after being collapsed", async () => {
    const { rerender } = setup({ isToggled: true });

    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));
    expect(screen.queryByText("card body")).not.toBeInTheDocument();

    rerender({ isToggled: false });
    rerender({ isToggled: true });

    expect(screen.getByText("card body")).toBeVisible();
  });

  it("reflects the controlled open prop", () => {
    setup({ open: false });

    expect(screen.getByRole("button", { name: "Expand GPU" })).toBeInTheDocument();
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("notifies open changes through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    setup({ onOpenChange });

    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the enable switch while toggleDisabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", onToggle, toggleDisabled: true });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeDisabled();
    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("expands an off card via the chevron without enabling it while toggleDisabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU", onToggle, toggleDisabled: true });

    expect(screen.queryByText("card body")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand GPU" }));

    expect(onToggle).not.toHaveBeenCalled();
    expect(screen.getByText("card body")).toBeVisible();
  });

  it("still lets an enabled card collapse while toggleDisabled", async () => {
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", toggleDisabled: true });

    expect(screen.getByText("card body")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("expands a collapsed enabled card when the chevron is clicked", async () => {
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", defaultOpen: false });

    expect(screen.queryByText("card body")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand GPU" }));
    expect(screen.getByText("card body")).toBeVisible();
  });

  it("disables a collapsed enabled card when the switch is turned off", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", onToggle, defaultOpen: false });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("keeps the switch disabled on an off card while toggleDisabled", async () => {
    const onToggle = vi.fn();
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU", onToggle, toggleDisabled: true });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeDisabled();
    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("collapses an opened off card via the chevron while toggleDisabled", async () => {
    setup({ isToggled: false, toggleAriaLabel: "Enable GPU", toggleDisabled: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand GPU" }));
    expect(screen.getByText("card body")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Collapse GPU" }));
    expect(screen.queryByText("card body")).not.toBeInTheDocument();
  });

  it("expands a collapsed enabled card via the chevron while toggleDisabled", async () => {
    setup({ isToggled: true, toggleAriaLabel: "Enable GPU", toggleDisabled: true, defaultOpen: false });

    expect(screen.queryByText("card body")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expand GPU" }));
    expect(screen.getByText("card body")).toBeVisible();
  });

  describe("when onHeaderClick is provided", () => {
    it("fires onHeaderClick when the header is clicked", async () => {
      const onHeaderClick = vi.fn();
      setup({ onHeaderClick });

      await userEvent.click(screen.getByText("GPU"));

      expect(onHeaderClick).toHaveBeenCalledTimes(1);
    });

    it("renders no chevron and no collapse trigger", () => {
      setup({ onHeaderClick: vi.fn() });

      expect(screen.queryByRole("button", { name: /Collapse GPU|Expand GPU/ })).not.toBeInTheDocument();
    });

    it("does not render the body", () => {
      setup({ onHeaderClick: vi.fn() });

      expect(screen.queryByText("card body")).not.toBeInTheDocument();
    });

    it("renders the summary alongside the title", () => {
      setup({ onHeaderClick: vi.fn(), summary: "None set" });

      expect(screen.getByText("None set")).toBeInTheDocument();
    });

    it("renders a lock indicator in the header when locked", () => {
      setup({ onHeaderClick: vi.fn(), locked: true });

      expect(screen.getByLabelText("Locked")).toBeInTheDocument();
    });

    it("does not fire onHeaderClick when the info icon is clicked", async () => {
      const onHeaderClick = vi.fn();
      setup({ onHeaderClick, infoTooltip: "helpful info" });

      await userEvent.click(screen.getByLabelText("More information"));

      expect(onHeaderClick).not.toHaveBeenCalled();
    });

    it("renders an enable switch when isToggled is provided", () => {
      setup({ onHeaderClick: vi.fn(), isToggled: false, toggleAriaLabel: "Enable GPU" });

      expect(screen.getByRole("switch", { name: "Enable GPU" })).not.toBeChecked();
    });

    it("fires onToggle from the header switch without firing onHeaderClick", async () => {
      const onToggle = vi.fn();
      const onHeaderClick = vi.fn();
      setup({ onHeaderClick, onToggle, isToggled: false, toggleAriaLabel: "Enable GPU" });

      await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));

      expect(onToggle).toHaveBeenCalledWith(true);
      expect(onHeaderClick).not.toHaveBeenCalled();
    });

    it("fires onHeaderClick when the title is clicked without toggling", async () => {
      const onToggle = vi.fn();
      const onHeaderClick = vi.fn();
      setup({ onHeaderClick, onToggle, isToggled: true, toggleAriaLabel: "Enable GPU" });

      await userEvent.click(screen.getByText("GPU"));

      expect(onHeaderClick).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("disables the enable switch while toggleDisabled", async () => {
      const onToggle = vi.fn();
      setup({ onHeaderClick: vi.fn(), onToggle, isToggled: true, toggleAriaLabel: "Enable GPU", toggleDisabled: true });

      expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeDisabled();
      await userEvent.click(screen.getByRole("switch", { name: "Enable GPU" }));
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("fires onHeaderClick from the chevron without toggling", async () => {
      const onToggle = vi.fn();
      const onHeaderClick = vi.fn();
      setup({ onHeaderClick, onToggle, isToggled: true, toggleAriaLabel: "Enable GPU" });

      await userEvent.click(screen.getByRole("button", { name: "Open settings" }));

      expect(onHeaderClick).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    summary?: string;
    infoTooltip?: React.ReactNode;
    headerControl?: React.ReactNode;
    isToggled?: boolean;
    onToggle?: (toggled: boolean) => void;
    toggleAriaLabel?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onHeaderClick?: () => void;
    toggleDisabled?: boolean;
    defaultOpen?: boolean;
    locked?: boolean;
  }) {
    const card = (overrides: Partial<typeof input>) => (
      <CollapsibleCard
        title="GPU"
        icon={<svg />}
        infoTooltip={input.infoTooltip}
        summary={input.summary}
        headerControl={input.headerControl}
        isToggled={input.isToggled}
        onToggle={input.onToggle}
        toggleAriaLabel={input.toggleAriaLabel}
        open={input.open}
        onOpenChange={input.onOpenChange}
        onHeaderClick={input.onHeaderClick}
        toggleDisabled={input.toggleDisabled}
        defaultOpen={input.defaultOpen}
        locked={input.locked}
        {...overrides}
      >
        <p>card body</p>
      </CollapsibleCard>
    );
    const view = render(card({}));
    return { rerender: (overrides: Partial<typeof input>) => view.rerender(card(overrides)) };
  }
});
