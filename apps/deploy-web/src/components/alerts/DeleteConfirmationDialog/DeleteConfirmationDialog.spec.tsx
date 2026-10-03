import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DeleteConfirmationDialog } from "./DeleteConfirmationDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(DeleteConfirmationDialog.name, () => {
  it("asks to confirm the deletion it describes", async () => {
    const { onConfirm } = setup({});

    expect(screen.getByRole("dialog", { name: "Delete “Ops team”?" })).toHaveAccessibleDescription("This channel will no longer receive notifications.");

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it.each([
    { action: "the cancel button", close: () => userEvent.click(screen.getByRole("button", { name: "Cancel" })) },
    { action: "the close button", close: () => userEvent.click(screen.getByRole("button", { name: "Close" })) },
    { action: "escape", close: () => userEvent.keyboard("{Escape}") }
  ])("cancels from $action", async ({ close }) => {
    const { onCancel, onConfirm } = setup({});

    await close();

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays open and locked while the deletion is in flight", async () => {
    const { onCancel } = setup({ isDeleting: true });

    expect(screen.getByRole("button", { name: /Delete/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("explains a refusal and only offers to acknowledge it", async () => {
    const { onCancel } = setup({ refusal: "Alerts still use this channel." });

    expect(screen.getByRole("dialog")).toHaveTextContent("Alerts still use this channel.");
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "OK" }));

    expect(onCancel).toHaveBeenCalled();
  });

  function setup(input: { isDeleting?: boolean; refusal?: string }) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteConfirmationDialog
        title="Delete “Ops team”?"
        description="This channel will no longer receive notifications."
        refusal={input.refusal}
        isDeleting={input.isDeleting ?? false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    return { onConfirm, onCancel };
  }
});
