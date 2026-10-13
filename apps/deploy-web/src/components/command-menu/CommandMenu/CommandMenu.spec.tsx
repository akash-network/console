import React from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { COMMAND_PAGES, DEPLOYMENT_START_COMMANDS } from "../commandMenuCatalog";
import type { GlobalShortcutHandlers } from "../useGlobalShortcuts";
import type { DEPENDENCIES } from "./CommandMenu";
import { CommandMenu } from "./CommandMenu";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(CommandMenu.name, () => {
  it("starts with the menu and the shortcuts sheet closed", () => {
    setup();

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  it("opens from the trigger and records it", async () => {
    const { analyticsService } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_opened", { via: "button" });
  });

  it("opens from the shortcut and records it", () => {
    const { analyticsService, press } = setup();

    press(handlers => handlers.onToggleMenu());

    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_opened", { via: "shortcut" });
  });

  it("closes on a second shortcut without recording another opening", () => {
    const { analyticsService, press } = setup();

    press(handlers => handlers.onToggleMenu());
    press(handlers => handlers.onToggleMenu());

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledTimes(1);
  });

  it("closes when the dialog asks to", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
  });

  it("starts a deployment from its key and records it", () => {
    const { analyticsService, startDeployment, press } = setup();

    press(handlers => handlers.onStartDeployment(DEPLOYMENT_START_COMMANDS[1]));

    expect(startDeployment).toHaveBeenCalledWith("container");
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_action_ran", { action: "new_container", via: "shortcut" });
  });

  it("goes to a page from its keys and records it", () => {
    const { analyticsService, push, press } = setup();

    press(handlers => handlers.onGoTo(COMMAND_PAGES[3]));

    expect(push).toHaveBeenCalledWith("/billing");
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_action_ran", { action: "go_to_billing", via: "shortcut" });
  });

  it("opens the shortcuts sheet from its key and records it", () => {
    const { analyticsService, press } = setup();

    press(handlers => handlers.onShowShortcuts());

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_action_ran", { action: "keyboard_shortcuts", via: "shortcut" });
  });

  it("swaps the menu for the shortcuts sheet without recording the menu's own run again", async () => {
    const { analyticsService } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Open command menu" }));

    await userEvent.click(screen.getByRole("button", { name: "Show shortcuts" }));

    expect(screen.queryByRole("dialog", { name: "Command menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(analyticsService.track).not.toHaveBeenCalledWith("command_menu_action_ran", expect.anything());
  });

  it("closes the shortcuts sheet when the menu opens", () => {
    const { press } = setup();
    press(handlers => handlers.onShowShortcuts());

    press(handlers => handlers.onToggleMenu());

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
  });

  it("closes the shortcuts sheet when it asks to", async () => {
    const { press } = setup();
    press(handlers => handlers.onShowShortcuts());

    await userEvent.click(screen.getByRole("button", { name: "Close sheet" }));

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
  });

  function setup() {
    const analyticsService = mock<AnalyticsService>();
    const push = vi.fn();
    const startDeployment = vi.fn(async () => undefined);
    let handlers: GlobalShortcutHandlers | undefined;

    const dependencies: typeof DEPENDENCIES = {
      CommandMenuTrigger: ({ onClick }) => (
        <button type="button" onClick={onClick}>
          Open command menu
        </button>
      ),
      CommandMenuDialog: ({ isOpen, onOpenChange, onShowShortcuts }) => (
        <>
          {isOpen && (
            <div role="dialog" aria-label="Command menu">
              <button type="button" onClick={() => onOpenChange(false)}>
                Dismiss
              </button>
              <button type="button" onClick={onShowShortcuts}>
                Show shortcuts
              </button>
            </div>
          )}
        </>
      ),
      ShortcutsSheet: ({ isOpen, onOpenChange }) => (
        <>
          {isOpen && (
            <div role="dialog" aria-label="Keyboard shortcuts">
              <button type="button" onClick={() => onOpenChange(false)}>
                Close sheet
              </button>
            </div>
          )}
        </>
      ),
      useGlobalShortcuts: nextHandlers => {
        handlers = nextHandlers;
      },
      useStartDeployment: () => startDeployment,
      useRouter: () => mock<AppRouterInstance>({ push })
    };

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <CommandMenu dependencies={dependencies} />
      </TestContainerProvider>
    );

    const press = (run: (handlers: GlobalShortcutHandlers) => void) => act(() => run(handlers as GlobalShortcutHandlers));

    return { analyticsService, push, startDeployment, press };
  }
});
