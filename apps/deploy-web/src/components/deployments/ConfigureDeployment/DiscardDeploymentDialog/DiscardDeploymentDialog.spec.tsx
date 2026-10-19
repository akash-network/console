import { describe, expect, it, vi } from "vitest";

import { DiscardDeploymentDialog } from "./DiscardDeploymentDialog";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DiscardDeploymentDialog.name, () => {
  it("names what is discarded and what the user keeps doing instead", () => {
    setup({ open: true });

    const dialog = screen.getByRole("dialog", { name: "Discard this deployment?" });
    expect(dialog).toHaveAccessibleDescription("Leaving closes the deployment.");
    expect(within(dialog).getByText("Body copy")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep going" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("stays closed until opened", () => {
    setup({ open: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes without discarding when the user keeps going", async () => {
    const { onOpenChange, onDiscard } = setup({ open: true });

    await userEvent.click(screen.getByRole("button", { name: "Keep going" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("discards when the user confirms", async () => {
    const { onDiscard } = setup({ open: true });

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(onDiscard).toHaveBeenCalled();
  });

  function setup(input: { open: boolean }) {
    const onOpenChange = vi.fn();
    const onDiscard = vi.fn();

    render(
      <DiscardDeploymentDialog
        open={input.open}
        onOpenChange={onOpenChange}
        title="Discard this deployment?"
        description="Leaving closes the deployment."
        keepLabel="Keep going"
        discardLabel="Discard"
        onDiscard={onDiscard}
      >
        <p>Body copy</p>
      </DiscardDeploymentDialog>
    );

    return { onOpenChange, onDiscard };
  }
});
