import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import type { StartTrialWithCardResult } from "@src/hooks/useStartTrialWithCard/useStartTrialWithCard";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./TrialCardStep";
import { TrialCardStep } from "./TrialCardStep";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(TrialCardStep.name, () => {
  it("explains why a card is asked for and that it is not charged", () => {
    setup();

    expect(screen.getByRole("region", { name: "Add a card to start your free trial" })).toBeInTheDocument();
    expect(screen.getByText(/looks like others we have recently seen from the same network or email pattern/)).toBeInTheDocument();
    expect(screen.getByText(/Your card is not charged/)).toBeInTheDocument();
    expect(screen.getByText(/Each card can start one free trial, and prepaid cards can't start one/)).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-header")).toBeInTheDocument();
  });

  it("reports that the step was shown, once", () => {
    const { analyticsService, rerender } = setup();

    rerender();

    expect(analyticsService.track).toHaveBeenCalledExactlyOnceWith("trial_card_step_shown", { category: "onboarding" });
  });

  it("keeps the trial button off until the card is filled in", async () => {
    setup();

    expect(screen.getByRole("button", { name: "Start free trial" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Fill in the card" }));

    expect(screen.getByRole("button", { name: "Start free trial" })).toBeEnabled();
  });

  it("starts the trial with the card that was filled in and confirms it with a notice", async () => {
    const { startTrial, card, enqueueSnackbar } = setup({ result: { status: "started" } });
    await userEvent.click(screen.getByRole("button", { name: "Fill in the card" }));

    await userEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    expect(startTrial).toHaveBeenCalledExactlyOnceWith(card);
    expect(enqueueSnackbar).toHaveBeenCalledExactlyOnceWith(expect.anything(), { variant: "success" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows why the trial did not start, and clears it on the next attempt", async () => {
    const { startTrial, enqueueSnackbar } = setup({ result: { status: "failed", message: "This card has already started a free trial." } });
    await userEvent.click(screen.getByRole("button", { name: "Fill in the card" }));

    await userEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    expect(screen.getByRole("alert")).toHaveTextContent("This card has already started a free trial.");
    expect(enqueueSnackbar).not.toHaveBeenCalled();

    startTrial.mockResolvedValue({ status: "incomplete" });
    await userEvent.click(screen.getByRole("button", { name: "Start free trial" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("holds every action while the trial is being started", () => {
    setup({ isStarting: true });

    expect(screen.getByRole("button", { name: /Start free trial/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add credits instead" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
  });

  it("offers adding credits and leaving the card for later as ways around", async () => {
    const { onAddCredits, onSkip, startTrial } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Add credits instead" }));
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onAddCredits).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(startTrial).not.toHaveBeenCalled();
  });

  function setup(input: { result?: StartTrialWithCardResult; isStarting?: boolean } = {}) {
    const onAddCredits = vi.fn();
    const onSkip = vi.fn();
    const card = mock<NewCardHandle>();
    const startTrial = vi.fn<ReturnType<typeof DEPENDENCIES.useStartTrialWithCard>["startTrial"]>().mockResolvedValue(input.result ?? { status: "started" });
    const analyticsService = mock<AnalyticsService>();
    const enqueueSnackbar = vi.fn();
    const NewCardFields = forwardRef<NewCardHandle, { onCompleteChange: (isComplete: boolean) => void }>(function NewCardFields({ onCompleteChange }, ref) {
      useImperativeHandle(ref, () => card);

      return (
        <button type="button" onClick={() => onCompleteChange(true)}>
          Fill in the card
        </button>
      );
    });
    const dependencies: typeof DEPENDENCIES = {
      OnboardingHeader: () => <header data-testid="onboarding-header" />,
      NewCardFields: NewCardFields as typeof DEPENDENCIES.NewCardFields,
      useStartTrialWithCard: () => ({ startTrial, isStarting: input.isStarting ?? false }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };
    const element = <TrialCardStep onAddCredits={onAddCredits} onSkip={onSkip} dependencies={dependencies} />;
    const view = render(element);

    return { onAddCredits, onSkip, card, startTrial, analyticsService, enqueueSnackbar, rerender: () => view.rerender(element) };
  }
});
