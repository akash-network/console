import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { UsageDatePreset } from "@src/components/billing-usage/UsageContainer/usageDatePresets";
import { UsageHeaderActions } from "./UsageHeaderActions";

import { render, screen } from "@testing-library/react";
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

  function setup(input: { datePreset?: UsageDatePreset; isExportDisabled?: boolean } = {}) {
    const onDatePresetChange = vi.fn();
    const onExport = vi.fn();

    render(
      <UsageHeaderActions
        datePreset={input.datePreset ?? "last30Days"}
        onDatePresetChange={onDatePresetChange}
        onExport={onExport}
        isExportDisabled={input.isExportDisabled ?? false}
      />
    );

    return { onDatePresetChange, onExport };
  }
});
