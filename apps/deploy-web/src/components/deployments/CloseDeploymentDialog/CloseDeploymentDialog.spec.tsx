import { describe, expect, it, vi } from "vitest";

import type { CloseDeploymentTarget } from "./CloseDeploymentDialog";
import { CloseDeploymentDialog } from "./CloseDeploymentDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("CloseDeploymentDialog", () => {
  it("names the deployment it closes", () => {
    setup({ target: { dseqs: ["1786440078202"], name: "my-service" } });

    expect(screen.getByRole("heading", { name: "Close this deployment?" })).toBeInTheDocument();
    expect(screen.getByText("my-service")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("the deployment URL stops resolving");
    expect(screen.getByRole("combobox", { name: "Why are you closing this deployment?" })).toBeInTheDocument();
  });

  it("names the deployment by its dseq when it has no name", () => {
    setup({ target: { dseqs: ["1786440078202"], name: null } });

    expect(screen.getByText("deployment 1786440078202")).toBeInTheDocument();
  });

  it("words the dialog for every selected deployment when closing several", () => {
    setup({ target: { dseqs: ["1", "2", "3"] } });

    expect(screen.getByRole("heading", { name: "Close 3 deployments?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("the deployment URLs stop resolving");
    expect(screen.getByRole("combobox", { name: "Why are you closing these deployments?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close 3 deployments" })).toBeDisabled();
  });

  it("keeps the close button disabled until a reason is picked", async () => {
    const { user, onConfirm } = setup({});

    expect(screen.getByRole("button", { name: "Close deployment" })).toBeDisabled();

    await pickReason(user, "Cost or budget");
    await user.click(screen.getByRole("button", { name: "Close deployment" }));

    expect(onConfirm).toHaveBeenCalledWith({ closeReason: "cost_or_budget", closeReasonDetails: undefined });
  });

  it("asks for details only for the other reason and sends them along", async () => {
    const { user, onConfirm } = setup({});

    expect(screen.queryByRole("textbox", { name: "Tell us more (optional)" })).not.toBeInTheDocument();

    await pickReason(user, "Other");
    await user.type(screen.getByRole("textbox", { name: "Tell us more (optional)" }), "Moved to our own cluster");
    await user.click(screen.getByRole("button", { name: "Close deployment" }));

    expect(onConfirm).toHaveBeenCalledWith({ closeReason: "other", closeReasonDetails: "Moved to our own cluster" });
  });

  it("cancels without confirming from the cancel button", async () => {
    const { user, onConfirm, onCancel } = setup({});

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels when dismissed with escape", async () => {
    const { user, onCancel } = setup({});

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
  });

  async function pickReason(user: ReturnType<typeof userEvent.setup>, label: string) {
    await user.click(screen.getByRole("combobox", { name: /Why are you closing/ }));
    await user.click(await screen.findByRole("option", { name: label }));
  }

  function setup(input: { target?: CloseDeploymentTarget }) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<CloseDeploymentDialog target={input.target ?? { dseqs: ["1786440078202"], name: "my-service" }} onConfirm={onConfirm} onCancel={onCancel} />);

    return { user, onConfirm, onCancel };
  }
});
