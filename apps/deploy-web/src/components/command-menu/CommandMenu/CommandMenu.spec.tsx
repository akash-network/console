import React from "react";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { GlobalShortcutHandlers } from "../useGlobalShortcuts";
import type { DEPENDENCIES } from "./CommandMenu";
import { CommandMenu } from "./CommandMenu";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(CommandMenu.name, () => {
  it("starts closed", () => {
    setup();

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
  });

  it("opens from the trigger and records it", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_opened", { via: "button" });
  });

  it("opens from the shortcut and records it", () => {
    const { analyticsService, toggleMenu } = setup();

    toggleMenu();

    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_opened", { via: "shortcut" });
  });

  it("closes on a second shortcut without recording another opening", () => {
    const { analyticsService, toggleMenu } = setup();

    toggleMenu();
    toggleMenu();

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledTimes(1);
  });

  it("closes when the dialog asks to", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
  });

  function setup() {
    const analyticsService = mock<AnalyticsService>();
    let handlers: GlobalShortcutHandlers | undefined;

    const dependencies: typeof DEPENDENCIES = {
      CommandMenuTrigger: ({ onClick }) => (
        <button type="button" onClick={onClick}>
          Open command menu
        </button>
      ),
      CommandMenuDialog: ({ isOpen, onOpenChange }) => (
        <>
          {isOpen && (
            <div role="dialog" aria-label="Command menu">
              <button type="button" onClick={() => onOpenChange(false)}>
                Dismiss
              </button>
            </div>
          )}
        </>
      ),
      useGlobalShortcuts: nextHandlers => {
        handlers = nextHandlers;
      }
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <CommandMenu dependencies={dependencies} />
      </TestContainerProvider>
    );

    const toggleMenu = () => act(() => handlers?.onToggleMenu());

    return { analyticsService, toggleMenu };
  }
});
