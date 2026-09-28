import { describe, expect, it, vi } from "vitest";

import { ToggleRow } from "./ToggleRow";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ToggleRow.name, () => {
  it("describes the setting and reports a flip of its switch", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ToggleRow
        label="GPU interconnect"
        description="High-bandwidth GPU-to-GPU fabric for multi-node jobs."
        switchLabel="Enable GPU interconnect"
        checked={false}
        onCheckedChange={onCheckedChange}
      />
    );

    await userEvent.click(screen.getByText("GPU interconnect"));

    expect(screen.getByText("High-bandwidth GPU-to-GPU fabric for multi-node jobs.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
