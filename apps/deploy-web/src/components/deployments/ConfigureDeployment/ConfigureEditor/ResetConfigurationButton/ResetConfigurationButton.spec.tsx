import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import { ResetConfigurationButton } from "./ResetConfigurationButton";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ResetConfigurationButton.name, () => {
  it("asks for confirmation before resetting", async () => {
    const { onReset } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Reset configuration" }));

    expect(screen.getByRole("dialog", { name: "Start over?" })).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets once confirmed and closes the confirmation", async () => {
    const { onReset } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Reset configuration" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the configuration when the confirmation is cancelled", async () => {
    const { onReset } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Reset configuration" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cannot be used while the configuration is locked", () => {
    setup({ disabled: true });

    expect(screen.getByRole("button", { name: "Reset configuration" })).toBeDisabled();
  });

  function setup(input: { disabled?: boolean }) {
    const onReset = vi.fn();
    render(
      <TooltipProvider>
        <ResetConfigurationButton disabled={input.disabled} onReset={onReset} />
      </TooltipProvider>
    );
    return { onReset };
  }
});
