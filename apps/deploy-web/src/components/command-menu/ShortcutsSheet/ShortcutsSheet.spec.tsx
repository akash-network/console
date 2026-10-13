import React from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { ShortcutsSheet } from "./ShortcutsSheet";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ShortcutsSheet.name, () => {
  it("opens as a dialog named after its title", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists every shortcut under its group", () => {
    setup({});

    expect(rowLabels("General")).toEqual(["Open command menu", "Keyboard shortcuts", "Close menu or dialog"]);
    expect(rowLabels("Actions")).toEqual(["New deployment", "New container", "New Linux machine"]);
    expect(rowLabels("Go to")).toEqual(["Deployments", "Templates", "Providers", "Billing", "API Keys", "Usage", "Alerts"]);
    expect(rowLabels("In the command menu")).toEqual(["Move selection", "Open", "Cycle filter", "Actions only", "Deployments only", "Pages only"]);
  });

  it("prints each row's keys", () => {
    setup({});

    expect(keysOf("General", "Keyboard shortcuts")).toEqual(["?"]);
    expect(keysOf("General", "Close menu or dialog")).toEqual(["Esc"]);
    expect(keysOf("Actions", "New deployment")).toEqual(["N"]);
    expect(keysOf("Go to", "API Keys")).toEqual(["G", "K"]);
    expect(keysOf("In the command menu", "Move selection")).toEqual(["↑", "↓"]);
    expect(keysOf("In the command menu", "Deployments only")).toEqual(["@"]);
  });

  it("reads the go-to keys as a sequence", () => {
    setup({});

    expect(row("Go to", "Templates")).toHaveTextContent("G then T");
  });

  it("shows the Mac keys on a Mac", () => {
    setup({ platform: "MacIntel" });

    expect(keysOf("General", "Open command menu")).toEqual(["⌘", "K"]);
    expect(keysOf("Actions", "New container")).toEqual(["⇧", "C"]);
  });

  it("spells the modifier keys out elsewhere", () => {
    setup({ platform: "Win32" });

    expect(keysOf("General", "Open command menu")).toEqual(["Ctrl", "K"]);
    expect(keysOf("Actions", "New Linux machine")).toEqual(["Shift", "L"]);
  });

  it("closes from its close button", async () => {
    const { onOpenChange } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape", async () => {
    const { onOpenChange } = setup({});

    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  function group(title: string) {
    return screen.getByRole("region", { name: title });
  }

  function rowLabels(title: string) {
    return within(group(title))
      .getAllByRole("listitem")
      .map(item => item.firstChild?.textContent);
  }

  function row(title: string, label: string) {
    return within(group(title))
      .getAllByRole("listitem")
      .find(item => item.firstChild?.textContent === label) as HTMLElement;
  }

  function keysOf(title: string, label: string) {
    return [...row(title, label).querySelectorAll("kbd")].map(kbd => kbd.textContent);
  }

  function setup(input: { isOpen?: boolean; platform?: string }) {
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue(input.platform ?? "Win32");
    onTestFinished(() => platform.mockRestore());
    const onOpenChange = vi.fn();

    render(<ShortcutsSheet isOpen={input.isOpen ?? true} onOpenChange={onOpenChange} />);

    return { onOpenChange };
  }
});
