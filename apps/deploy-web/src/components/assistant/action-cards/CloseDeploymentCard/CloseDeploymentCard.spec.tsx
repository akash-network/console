import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CloseOutcome } from "@src/hooks/useCloseDeployment/useCloseDeployment";
import type { AssistantActionOf } from "@src/types/assistant";
import type { ActionCardChromeProps } from "../ActionCardChrome/ActionCardChrome";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import type { ActionCardDecision } from "../useActionCardDecision/useActionCardDecision";
import type { DEPENDENCIES } from "./CloseDeploymentCard";
import { CloseDeploymentCard } from "./CloseDeploymentCard";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Container = ReturnType<typeof DEPENDENCIES.useServices>;

describe(CloseDeploymentCard.name, () => {
  it("is a destructive card that names the deployment and spells out what closing does", () => {
    const { chromeProps, useDeploymentName, decision } = setup({});

    expect(chromeProps()).toEqual(
      expect.objectContaining({
        title: "Close blog",
        scope: expect.objectContaining({ type: DeploymentLink, props: { dseq: "42", name: "blog" } }),
        tier: "destructive",
        decision,
        costNote: "All services stop right away and the deployment URL stops resolving. Unspent funds go back to your balance.",
        irreversibleNote: "This can't be undone. Running this workload again needs a new deployment.",
        confirmLabel: "Close deployment"
      })
    );
    expect(useDeploymentName).toHaveBeenCalledWith("42", "blog");
  });

  it("calls a deployment without a name this deployment", () => {
    const { chromeProps } = setup({ name: null });

    expect(chromeProps().title).toBe("Close this deployment");
  });

  it("asks for the reason with the close dialog's options, prefilled with the one the user gave", async () => {
    setup({ reason: "cost_or_budget" });

    expect(screen.getByRole("combobox", { name: "Why are you closing this deployment?" })).toHaveTextContent("Cost or budget");
    await userEvent.click(screen.getByRole("combobox", { name: "Why are you closing this deployment?" }));
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual([
      "No longer needed",
      "Cost or budget",
      "Migrating elsewhere",
      "Performance or reliability",
      "Testing or project complete",
      "Other"
    ]);
  });

  it("closes through the same request as the deployment page and records the reason", async () => {
    const { chromeProps, closeDeployment, recordCloseReason, track } = setup({ reason: "no_longer_needed" });

    await act(() => chromeProps().onConfirm!(""));

    expect(closeDeployment).toHaveBeenCalledWith("42");
    expect(recordCloseReason).toHaveBeenCalledWith(["42"], { closeReason: "no_longer_needed", closeReasonDetails: undefined });
    expect(track).toHaveBeenCalledWith("close_deployment", {
      category: "deployments",
      label: "Close deployment from the assistant",
      reason: "no_longer_needed"
    });
    expect(chromeProps().successMessage).toBe("Closed. Unspent funds are back in your balance.");
  });

  it("sends the details only for the other reason, as the close dialog does", async () => {
    const { chromeProps, recordCloseReason } = setup({ reason: "other", reasonDetails: "Moving to our own cluster" });

    expect(screen.getByRole("textbox", { name: "Tell us more (optional)" })).toHaveValue("Moving to our own cluster");
    await userEvent.type(screen.getByRole("textbox", { name: "Tell us more (optional)" }), " soon");
    await act(() => chromeProps().onConfirm!(""));

    expect(recordCloseReason).toHaveBeenCalledWith(["42"], { closeReason: "other", closeReasonDetails: "Moving to our own cluster soon" });
  });

  it("records the reason the user switched to", async () => {
    const { chromeProps, recordCloseReason } = setup({ reason: "other", reasonDetails: "typed before" });

    await userEvent.click(screen.getByRole("combobox", { name: "Why are you closing this deployment?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Migrating elsewhere" }));
    await act(() => chromeProps().onConfirm!(""));

    expect(screen.queryByRole("textbox", { name: "Tell us more (optional)" })).not.toBeInTheDocument();
    expect(recordCloseReason).toHaveBeenCalledWith(["42"], { closeReason: "migrating_elsewhere", closeReasonDetails: undefined });
  });

  it("says a close that runs in the background is still closing", async () => {
    const { chromeProps } = setup({ outcome: "closing" });

    await act(() => chromeProps().onConfirm!(""));

    expect(chromeProps().successMessage).toBe("Closing. You'll get a notification when it's done.");
  });

  it("fails the card without recording a reason when the close did not happen", async () => {
    const { chromeProps, recordCloseReason } = setup({ outcome: "not_closed" });

    await expect(chromeProps().onConfirm!("")).rejects.toThrow("The deployment wasn't closed. Try again in a moment.");
    expect(recordCloseReason).not.toHaveBeenCalled();
  });

  it("hides the reason once the card is settled", () => {
    setup({ status: "succeeded" });

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  function setup(input: {
    name?: string | null;
    reason?: AssistantActionOf<"close_deployment">["reason"];
    reasonDetails?: string;
    outcome?: CloseOutcome;
    status?: ActionCardDecision["status"];
  }) {
    const useDeploymentName = vi.fn((_dseq: string | null | undefined, knownName?: string | null): string | null => knownName ?? null);
    const closeDeployment = vi.fn(async (_dseq: string) => input.outcome ?? ("closed" as CloseOutcome));
    const recordCloseReason = vi.fn();
    const track = vi.fn();
    const ActionCardChrome = vi.fn((props: ActionCardChromeProps) => <>{props.children}</>);
    const decision = mock<ActionCardDecision>({ status: input.status ?? "pending" });

    render(
      <CloseDeploymentCard
        action={{
          type: "close_deployment",
          tier: "destructive",
          dseq: "42",
          name: input.name === undefined ? "blog" : input.name,
          reason: input.reason ?? "no_longer_needed",
          reasonDetails: input.reasonDetails ?? null
        }}
        decision={decision}
        dependencies={{
          useDeploymentName,
          useServices: () => Object.assign(mock<Container>(), { analyticsService: mock<Container["analyticsService"]>({ track }) }),
          useCloseDeployment: () => closeDeployment,
          useCloseDeploymentConfirm: () => mock<ReturnType<typeof DEPENDENCIES.useCloseDeploymentConfirm>>({ recordCloseReason }),
          ActionCardChrome: ActionCardChrome as unknown as typeof DEPENDENCIES.ActionCardChrome
        }}
      />
    );

    return { useDeploymentName, chromeProps: () => ActionCardChrome.mock.lastCall![0], closeDeployment, recordCloseReason, track, decision };
  }
});
