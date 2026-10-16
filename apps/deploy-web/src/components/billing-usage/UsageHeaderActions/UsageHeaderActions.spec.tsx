import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScopeControl } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import type { UsageDatePreset } from "@src/components/billing-usage/UsageContainer/usageDatePresets";
import { UsageHeaderActions } from "./UsageHeaderActions";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(UsageHeaderActions.name, () => {
  it("shows the selected range", () => {
    setup({ datePreset: "last90Days" });

    expect(screen.getByRole("combobox", { name: "Date range" })).toHaveTextContent("Last 90 days");
  });

  it("switches to the range picked from the menu", async () => {
    const { onDatePresetChange } = setup({ datePreset: "last30Days" });

    await userEvent.click(screen.getByRole("combobox", { name: "Date range" }));
    await userEvent.click(screen.getByRole("option", { name: "Last 12 months" }));

    expect(onDatePresetChange).toHaveBeenCalledWith("last12Months");
  });

  it("exports the usage as CSV", async () => {
    const { onExport } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(onExport).toHaveBeenCalled();
  });

  it("holds the export back while there is nothing to export yet", () => {
    setup({ isExportDisabled: true });

    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("offers no project filter outside a team", () => {
    setup();

    expect(screen.queryByRole("combobox", { name: "Projects" })).not.toBeInTheDocument();
  });

  it("shows every project until one is picked", () => {
    setup({ projectScope: { selected: null } });

    expect(screen.getByRole("combobox", { name: "Projects" })).toHaveTextContent("All projects");
  });

  it("narrows the page to the project picked from the menu", async () => {
    const { onProjectScopeChange } = setup({ projectScope: { selected: null } });

    await userEvent.click(screen.getByRole("combobox", { name: "Projects" }));
    await userEvent.click(screen.getByRole("option", { name: "storefront" }));

    expect(onProjectScopeChange).toHaveBeenCalledWith("storefront-id");
  });

  it("goes back to every project", async () => {
    const { onProjectScopeChange } = setup({ projectScope: { selected: "storefront-id" } });

    expect(screen.getByRole("combobox", { name: "Projects" })).toHaveTextContent("storefront");

    await userEvent.click(screen.getByRole("combobox", { name: "Projects" }));
    await userEvent.click(screen.getByRole("option", { name: "All projects" }));

    expect(onProjectScopeChange).toHaveBeenCalledWith(null);
  });

  it("offers only every project while the team has none to list", async () => {
    setup({ projectScope: { selected: null, projects: [] } });

    await userEvent.click(screen.getByRole("combobox", { name: "Projects" }));

    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["All projects"]);
    expect(within(screen.getByRole("listbox")).queryByText("Projects")).not.toBeInTheDocument();
  });

  function setup(input: { datePreset?: UsageDatePreset; isExportDisabled?: boolean; projectScope?: Partial<ProjectScopeControl> } = {}) {
    const onDatePresetChange = vi.fn();
    const onExport = vi.fn();
    const onProjectScopeChange = vi.fn();

    render(
      <UsageHeaderActions
        datePreset={input.datePreset ?? "last30Days"}
        onDatePresetChange={onDatePresetChange}
        onExport={onExport}
        isExportDisabled={input.isExportDisabled ?? false}
        projectScope={
          input.projectScope && {
            projects: [
              { id: "storefront-id", name: "storefront" },
              { id: "marketing-id", name: "marketing" }
            ],
            selected: null,
            onChange: onProjectScopeChange,
            ...input.projectScope
          }
        }
      />
    );

    return { onDatePresetChange, onExport, onProjectScopeChange };
  }
});
