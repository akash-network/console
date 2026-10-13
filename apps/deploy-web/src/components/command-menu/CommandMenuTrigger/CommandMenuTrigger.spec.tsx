import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./CommandMenuTrigger";
import { CommandMenuTrigger } from "./CommandMenuTrigger";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(CommandMenuTrigger.name, () => {
  it("is named and titled after what it opens", () => {
    setup({ isMac: true });

    expect(screen.getByRole("button", { name: "Search or run a command" })).toHaveAttribute("title", "Search or run a command");
  });

  it("shows the Mac shortcut on a Mac", () => {
    setup({ isMac: true });

    const trigger = screen.getByRole("button", { name: "Search or run a command" });
    expect(trigger).toHaveTextContent("⌘K");
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Meta+K");
  });

  it("shows the Ctrl shortcut elsewhere", () => {
    setup({ isMac: false });

    const trigger = screen.getByRole("button", { name: "Search or run a command" });
    expect(trigger).toHaveTextContent("Ctrl K");
    expect(trigger).toHaveAttribute("aria-keyshortcuts", "Control+K");
  });

  it("leaves the shortcut out until the platform is known", () => {
    setup({ isMac: undefined });

    const trigger = screen.getByRole("button", { name: "Search or run a command" });
    expect(trigger).toHaveTextContent("");
    expect(trigger).not.toHaveAttribute("aria-keyshortcuts");
  });

  it("opens the menu on click", async () => {
    const { onClick } = setup({ isMac: true });

    await userEvent.click(screen.getByRole("button", { name: "Search or run a command" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  function setup(input: { isMac: boolean | undefined }) {
    const onClick = vi.fn();
    const dependencies: typeof DEPENDENCIES = { useIsMac: () => input.isMac };

    render(<CommandMenuTrigger onClick={onClick} dependencies={dependencies} />);

    return { onClick };
  }
});
