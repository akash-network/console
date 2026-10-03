import { describe, expect, it, vi } from "vitest";

import { RevokeApiKeyDialog } from "./RevokeApiKeyDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildApiKey } from "@tests/seeders";

describe("RevokeApiKeyDialog", () => {
  it("asks to confirm revoking the named key and warns it can't be undone", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Revoke “CI/CD pipeline”?" })).toBeInTheDocument();
    expect(screen.getByText(/starts getting 401 Unauthorized right away. This can't be undone./)).toBeInTheDocument();
  });

  it("revokes the key once confirmed", async () => {
    const { user, onConfirm } = setup();

    await user.click(screen.getByRole("button", { name: "Revoke key" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("keeps the key when cancelled", async () => {
    const { user, onConfirm, onCancel } = setup();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the key when closed from its close button", async () => {
    const { user, onConfirm, onCancel } = setup();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the key when dismissed with Escape", async () => {
    const { user, onCancel } = setup();

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables both actions while the key is being revoked", () => {
    setup({ isRevoking: true });

    expect(screen.getByRole("button", { name: /Revoke key/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("stays open while the key is being revoked", async () => {
    const { user, onCancel } = setup({ isRevoking: true });

    await user.keyboard("{Escape}");

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  function setup(input: { isRevoking?: boolean } = {}) {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <RevokeApiKeyDialog apiKey={buildApiKey({ name: "CI/CD pipeline" })} isRevoking={input.isRevoking ?? false} onConfirm={onConfirm} onCancel={onCancel} />
    );

    return { user, onConfirm, onCancel };
  }
});
