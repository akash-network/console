import React from "react";
import { Layers, Plus, Wallet } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { CommandSection } from "../commandMenuSearch";
import type { CommandItem } from "../useCommandMenuItems";
import type { DEPENDENCIES } from "./CommandMenuDialog";
import { CommandMenuDialog } from "./CommandMenuDialog";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(CommandMenuDialog.name, () => {
  it("opens as a labelled dialog with the search field focused and the first row selected", () => {
    setup({});

    expect(screen.getByRole("dialog", { name: "Command menu" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.getByRole("combobox")).toHaveAttribute("placeholder", "Search or run a command (try “>” for actions)");
    expect(selectedOption()).toHaveTextContent("New deployment");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", selectedOption().id);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("leads action rows with their icon", () => {
    setup({});

    const row = screen.getByRole("option", { name: "New deployment" });
    expect(row.querySelector(".lucide-plus")).toBeInTheDocument();
    expect(row.querySelector("[data-status-dot]")).not.toBeInTheDocument();
    expect(within(row).getByText("New deployment")).not.toHaveAttribute("data-monospace");
  });

  it("returns the focus to where it was when closed without running a row", async () => {
    const { setOpen } = setup({ isOpen: false });
    screen.getByRole("button", { name: "Before" }).focus();
    setOpen(true);

    await userEvent.keyboard("{Escape}");
    setOpen(false);

    await waitFor(() => expect(screen.getByRole("button", { name: "Before" })).toHaveFocus());
  });

  it("returns the focus after running a row that keeps the user on the page", async () => {
    const { setOpen } = setup({
      isOpen: false,
      sections: sectionsWith({
        actions: [{ id: "action-toggle-theme", label: "Switch to dark theme", staysOnPage: true, action: "toggle_theme", run: vi.fn() }]
      })
    });
    screen.getByRole("button", { name: "Before" }).focus();
    setOpen(true);

    await userEvent.keyboard("{Enter}");
    setOpen(false);

    await waitFor(() => expect(screen.getByRole("button", { name: "Before" })).toHaveFocus());
  });

  it("leaves the focus alone after running a row, which moves the user elsewhere", async () => {
    const { setOpen } = setup({ isOpen: false });
    screen.getByRole("button", { name: "Before" }).focus();
    setOpen(true);

    await userEvent.keyboard("{Enter}");
    setOpen(false);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(screen.getByRole("button", { name: "Before" })).not.toHaveFocus();
  });

  it("hands the shortcuts sheet opener to the menu items", () => {
    const { useCommandMenuItems, onShowShortcuts } = setup({});

    expect(useCommandMenuItems).toHaveBeenCalledWith(expect.objectContaining({ onShowShortcuts }));
  });

  it("shows a row's shortcut without adding it to the row's name", () => {
    setup({
      sections: sectionsWith({
        actions: [{ id: "action-new-container", label: "New container", shortcut: { keys: ["shift", "C"] }, action: "new_container", run: vi.fn() }]
      })
    });

    const row = screen.getByRole("option", { name: "New container" });
    expect([...row.querySelectorAll("kbd")].map(kbd => kbd.textContent)).toEqual(["Shift", "C"]);
  });

  it("groups rows under their section headings", () => {
    setup({});

    expect(
      within(screen.getByRole("group", { name: "Actions" }))
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual(["New deployment", "Add funds"]);
    expect(
      within(screen.getByRole("group", { name: "Pages" }))
        .getAllByRole("option")
        .map(option => option.textContent)
    ).toEqual(["Templates", "Billing"]);
  });

  it("filters and reorders the rows as the user types", async () => {
    setup({});

    await userEvent.type(screen.getByRole("combobox"), "bill");

    expect(optionLabels()).toEqual(["Billing", "Add funds"]);
    expect(selectedOption()).toHaveTextContent("Billing");
  });

  it("says when nothing matches", async () => {
    setup({});

    await userEvent.type(screen.getByRole("combobox"), "Zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No results for “Zzz”");
    expect(screen.getByRole("combobox")).not.toHaveAttribute("aria-activedescendant");
  });

  it("says there are no results in an empty scope without quoting an empty query", async () => {
    setup({ sections: sectionsWith({ deployments: [] }) });

    await userEvent.type(screen.getByRole("combobox"), "@");

    expect(screen.getByRole("status")).toHaveTextContent(/^No results$/);
  });

  it("moves the selection with the arrow keys and wraps at both ends", async () => {
    setup({});

    await userEvent.keyboard("{ArrowDown}");
    expect(selectedOption()).toHaveTextContent("Add funds");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", selectedOption().id);

    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(selectedOption()).toHaveTextContent("Billing");
  });

  it("runs the selected row with Enter, records it and closes", async () => {
    const { runs, onOpenChange, analyticsService } = setup({});

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(runs.addFunds).toHaveBeenCalled();
    expect(runs.newDeployment).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(analyticsService.track).toHaveBeenCalledWith("command_menu_action_ran", { action: "add_funds", via: "menu" });
  });

  it("runs a row on click", async () => {
    const { runs, onOpenChange } = setup({});

    await userEvent.click(screen.getByRole("option", { name: "Templates" }));

    expect(runs.templates).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("selects the row under the pointer", async () => {
    setup({});

    await userEvent.hover(screen.getByRole("option", { name: "Billing" }));

    expect(selectedOption()).toHaveTextContent("Billing");
  });

  it("cycles the scope with Tab and Shift+Tab, keeping the query and the focus", async () => {
    setup({});
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "bill");

    await userEvent.tab();
    expect(input).toHaveValue("> bill");

    await userEvent.tab();
    expect(input).toHaveValue("@ bill");

    await userEvent.tab({ shift: true });
    await userEvent.tab({ shift: true });
    expect(input).toHaveValue("bill");

    await userEvent.tab({ shift: true });
    expect(input).toHaveValue("/ bill");
    expect(input).toHaveFocus();
  });

  it("limits the rows to the scope typed as a prefix", async () => {
    setup({});

    await userEvent.type(screen.getByRole("combobox"), "/");

    expect(screen.queryByRole("group", { name: "Actions" })).not.toBeInTheDocument();
    expect(optionLabels()).toEqual(["Templates", "Billing"]);
  });

  it("toggles a scope from the footer without taking the focus", async () => {
    setup({});
    const input = screen.getByRole("combobox");

    await userEvent.click(screen.getByRole("button", { name: "> actions" }));

    expect(input).toHaveValue("> ");
    expect(screen.getByRole("button", { name: "> actions" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "@ deployments" })).toHaveAttribute("aria-pressed", "false");
    expect(input).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "> actions" }));

    expect(input).toHaveValue("");
  });

  it("closes from the esc button without running a row", async () => {
    const { runs, onOpenChange } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Close (esc)" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(runs.newDeployment).not.toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onOpenChange } = setup({});

    await userEvent.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a deployment with its status, mono name and caption", async () => {
    setup({ sections: sectionsWith({ deployments: [deploymentItem({ id: "deployment-100", label: "web", meta: "DSEQ 100" })] }) });

    await userEvent.type(screen.getByRole("combobox"), "@");

    const row = screen.getByRole("option", { name: /^web/ });
    expect(row.querySelector("[data-status-dot]")).toHaveClass("bg-emerald-500");
    expect(within(row).getByText("web")).toHaveAttribute("data-monospace", "true");
    expect(within(row).getByText("DSEQ 100")).toBeInTheDocument();
  });

  it("keeps Enter on the strongest match when late results reorder the rows", async () => {
    const { rerenderWith } = setup({ sections: sectionsWith({ deployments: [] }) });
    await userEvent.type(screen.getByRole("combobox"), "bill");
    expect(selectedOption()).toHaveTextContent("Billing");

    rerenderWith(sectionsWith({ deployments: [deploymentItem({ id: "deployment-100", label: "billing-api", meta: "DSEQ 100" })] }));

    expect(selectedOption()).toHaveTextContent("billing-api");
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", selectedOption().id);
  });

  it("keeps a selection the user moved when late results arrive", async () => {
    const { rerenderWith } = setup({});
    await userEvent.keyboard("{ArrowDown}");

    rerenderWith(sectionsWith({ deployments: [deploymentItem({ id: "deployment-100", label: "web", meta: "DSEQ 100" })] }));

    expect(selectedOption()).toHaveTextContent("Add funds");
  });

  it("falls back to the first row when the selected one disappears", async () => {
    const { rerenderWith } = setup({});
    await userEvent.keyboard("{ArrowDown}");

    rerenderWith(sectionsWith({ actions: [] }));

    expect(selectedOption()).toHaveTextContent("Templates");
  });

  function selectedOption() {
    return screen.getAllByRole("option").find(option => option.getAttribute("aria-selected") === "true") as HTMLElement;
  }

  function optionLabels() {
    return screen.getAllByRole("option").map(option => option.textContent);
  }

  function deploymentItem(input: { id: string; label: string; meta: string }): CommandItem {
    return { ...input, keywords: "100", isMonospace: true, statusDotClassName: "bg-emerald-500", action: "open_deployment", run: vi.fn() };
  }

  function sectionsWith(overrides: { actions?: CommandItem[]; deployments?: CommandItem[] }, runs = createRuns()): CommandSection<CommandItem>[] {
    return [
      {
        key: "actions",
        label: "Actions",
        items: overrides.actions ?? [
          {
            id: "action-new-deployment",
            label: "New deployment",
            icon: Plus,
            keywords: "create deploy launch",
            action: "new_deployment",
            run: runs.newDeployment
          },
          { id: "action-add-funds", label: "Add funds", icon: Wallet, keywords: "billing balance top up credit", action: "add_funds", run: runs.addFunds }
        ]
      },
      { key: "deployments", label: "Deployments", items: overrides.deployments ?? [], emptyQueryLimit: 5 },
      {
        key: "pages",
        label: "Pages",
        items: [
          { id: "page-templates", label: "Templates", icon: Layers, keywords: "go to page", action: "go_to_templates", run: runs.templates },
          { id: "page-billing", label: "Billing", icon: Wallet, keywords: "go to page", action: "go_to_billing", run: runs.billing }
        ]
      }
    ];
  }

  function createRuns() {
    return { newDeployment: vi.fn(), addFunds: vi.fn(), templates: vi.fn(), billing: vi.fn() };
  }

  function setup(input: { sections?: CommandSection<CommandItem>[]; isOpen?: boolean }) {
    const runs = createRuns();
    const onOpenChange = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    let sections = input.sections ?? sectionsWith({}, runs);
    let isOpen = input.isOpen ?? true;
    const onShowShortcuts = vi.fn();
    const useCommandMenuItems = vi.fn<typeof DEPENDENCIES.useCommandMenuItems>(() => sections);
    const dependencies: typeof DEPENDENCIES = { useCommandMenuItems };

    const view = () => (
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <button type="button">Before</button>
        <CommandMenuDialog isOpen={isOpen} onOpenChange={onOpenChange} onShowShortcuts={onShowShortcuts} dependencies={dependencies} />
      </TestContainerProvider>
    );
    const { rerender } = render(view());

    const rerenderWith = (nextSections: CommandSection<CommandItem>[]) => {
      sections = nextSections;
      rerender(view());
    };

    const setOpen = (nextIsOpen: boolean) => {
      isOpen = nextIsOpen;
      rerender(view());
    };

    return { runs, onOpenChange, onShowShortcuts, useCommandMenuItems, analyticsService, rerenderWith, setOpen };
  }
});
