import React from "react";
import { describe, expect, it } from "vitest";

import type { KeyToken } from "../commandMenuCatalog";
import type { DEPENDENCIES } from "./Keycaps";
import { Keycaps } from "./Keycaps";

import { render, screen } from "@testing-library/react";

describe(Keycaps.name, () => {
  it("prints the Mac modifier symbols on a Mac", () => {
    const { keycaps } = setup({ keys: ["mod", "shift", "K"], isMac: true });

    expect(keycaps()).toEqual(["⌘", "⇧", "K"]);
    expect(screen.getByText("Command Shift K")).toBeInTheDocument();
  });

  it("spells the modifiers out elsewhere", () => {
    const { keycaps } = setup({ keys: ["mod", "shift", "K"], isMac: false });

    expect(keycaps()).toEqual(["Ctrl", "Shift", "K"]);
    expect(screen.getByText("Ctrl Shift K")).toBeInTheDocument();
  });

  it("falls back to the spelled-out modifiers until the platform is known", () => {
    const { keycaps } = setup({ keys: ["mod", "K"], isMac: undefined });

    expect(keycaps()).toEqual(["Ctrl", "K"]);
  });

  it("puts then between the keys of a sequence", () => {
    const { container } = setup({ keys: ["G", "T"], isSequence: true, isMac: true });

    expect(container).toHaveTextContent(/^GthenT/);
    expect(screen.getByText("G then T")).toBeInTheDocument();
  });

  it("keeps the keys of a chord side by side", () => {
    const { container } = setup({ keys: ["shift", "C"], isMac: false });

    expect(container).not.toHaveTextContent("then");
  });

  it("names symbol keys for screen readers and hides the printed keycaps from them", () => {
    const { container } = setup({ keys: ["↑", "↓", "↵", "⇥", "Esc", "?", ">", "@", "/"], isMac: true });

    expect(screen.getByText("Up arrow Down arrow Enter Tab Escape Question mark Greater than At sign Slash")).toBeInTheDocument();
    expect([...container.querySelectorAll("kbd")].every(kbd => kbd.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("hides entirely from screen readers when asked to", () => {
    const { container } = setup({ keys: ["N"], isMac: true, isHidden: true });

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });

  function setup(input: { keys: KeyToken[]; isSequence?: boolean; isMac: boolean | undefined; isHidden?: boolean }) {
    const dependencies: typeof DEPENDENCIES = { useIsMac: () => input.isMac };

    const { container } = render(<Keycaps keys={input.keys} isSequence={input.isSequence} aria-hidden={input.isHidden} dependencies={dependencies} />);
    const keycaps = () => [...container.querySelectorAll("kbd")].map(kbd => kbd.textContent);

    return { container, keycaps };
  }
});
