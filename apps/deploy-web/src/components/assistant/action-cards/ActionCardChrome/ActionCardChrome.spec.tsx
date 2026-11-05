import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { ActionCardChromeProps } from "./ActionCardChrome";
import { ActionCardChrome } from "./ActionCardChrome";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ActionCardChrome.name, () => {
  it("shows the title, scope, rows, changes and notes the card was built from", () => {
    setup({
      title: "Update sdxl-image-api",
      scope: "service: web",
      rows: [{ label: "Downtime", value: "container restarts once" }],
      diff: { removed: ["image: api:1.4.1"], added: ["image: api:1.4.2"], unchanged: "MODEL_ID unchanged" },
      costNote: "No change in cost.",
      irreversibleNote: "This can't be undone."
    });

    const card = screen.getByRole("region", { name: "Update sdxl-image-api" });
    expect(card).toHaveTextContent("service: web");
    expect(within(card).getByText("Downtime").nextSibling).toHaveTextContent("container restarts once");
    expect(within(card).getByLabelText("Changes")).toHaveTextContent("Before: image: api:1.4.1");
    expect(within(card).getByLabelText("Changes")).toHaveTextContent("After: image: api:1.4.2");
    expect(within(card).getByLabelText("Changes")).toHaveTextContent("MODEL_ID unchanged");
    expect(card).toHaveTextContent("No change in cost.");
    expect(card).toHaveTextContent("This can't be undone.");
  });

  it("runs the action through the decision on confirm", async () => {
    const { decision, onConfirm } = setup({ confirmLabel: "Send again" });

    await userEvent.click(screen.getByRole("button", { name: "Send again" }));

    expect(decision.confirm).toHaveBeenCalledTimes(1);
    await decision.confirm.mock.calls[0][0]();
    expect(onConfirm).toHaveBeenCalledWith("");
  });

  it("cancels through the decision", async () => {
    const { decision } = setup({});

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(decision.cancel).toHaveBeenCalledTimes(1);
  });

  it("asks a destructive card for a reason before it can be confirmed, and passes it on", async () => {
    const { decision, onConfirm } = setup({ tier: "destructive", reasonLabel: "Why are you closing it?", confirmLabel: "Close deployment" });

    expect(screen.getByRole("button", { name: "Close deployment" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Why are you closing it?"), "  Moving providers ");
    await userEvent.click(screen.getByRole("button", { name: "Close deployment" }));
    await decision.confirm.mock.calls[0][0]();

    expect(onConfirm).toHaveBeenCalledWith("Moving providers");
    expect(screen.getByRole("region")).toHaveAttribute("data-tier", "destructive");
  });

  it("keeps confirm disabled while the card says so", () => {
    setup({ isConfirmDisabled: true });

    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("locks the card while the action runs", () => {
    setup({ tier: "destructive", reasonLabel: "Reason", status: "running" });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Reason")).toBeDisabled();
  });

  it("shows the error in the card and offers to try again", () => {
    setup({ status: "failed", error: "Not enough credits" });

    expect(screen.getByRole("alert")).toHaveTextContent("Not enough credits");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("replaces the buttons with the outcome once done", () => {
    setup({ status: "succeeded", successMessage: "Sent." });

    expect(screen.getByRole("status")).toHaveTextContent("Sent.");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("says a cancelled card was cancelled", () => {
    setup({ status: "cancelled" });

    expect(screen.getByRole("status")).toHaveTextContent("Cancelled.");
  });

  it("opens a deep link instead of confirming in the card, and marks it opened", async () => {
    const { decision } = setup({ tier: "deep_link", deepLink: { href: "/billing?openPayment=true", label: "Open billing" }, onConfirm: undefined });
    const link = screen.getByRole("link", { name: "Open billing" });

    expect(link).toHaveAttribute("href", "/billing?openPayment=true");
    link.addEventListener("click", event => event.preventDefault());
    await userEvent.click(link);
    expect(decision.markOpened).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
  });

  it("says a deep link was opened", () => {
    setup({ status: "succeeded", deepLink: { href: "/billing", label: "Open billing" } });

    expect(screen.getByRole("status")).toHaveTextContent("Opened.");
  });

  it("offers only cancel when there is nothing to confirm", () => {
    setup({ onConfirm: undefined });

    expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["Cancel"]);
  });

  function setup(input: Partial<Omit<ActionCardChromeProps, "decision">> & { status?: ActionCardDecision["status"]; error?: string }) {
    const { status = "pending", error = null, ...props } = input;
    const decision = mock<ActionCardDecision>({ status, error, confirm: vi.fn(), cancel: vi.fn(), markOpened: vi.fn() });
    const onConfirm = vi.fn(async (_reason: string) => {});

    render(<ActionCardChrome title="Card" tier="confirm" decision={decision} onConfirm={onConfirm} {...props} />);

    return { decision, onConfirm };
  }
});
