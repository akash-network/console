import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, TrialStatusPanel } from "./TrialStatusPanel";
import type { TrialStatus } from "./useTrialStatus";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe("TrialStatusPanel", () => {
  it("renders nothing when the wallet is no longer trialing", () => {
    setup({ trial: { isTrialing: false } });

    expect(screen.queryByText("Free trial")).not.toBeInTheDocument();
  });

  it("shows the days remaining in the trial", () => {
    setup({ trial: { daysLeft: 18, totalDays: 30 } });

    expect(screen.getByText("18 days left")).toBeInTheDocument();
    expect(screen.getByText("of your 30 day trial")).toBeInTheDocument();
  });

  it("lists the trial limitations with the configured deployment duration", () => {
    setup({ trial: { deploymentDurationHours: 24 } });

    expect(screen.getByText("Deployments close automatically after 24 hours")).toBeInTheDocument();
    expect(screen.getByText("High-end GPUs stay locked, so trials run on CPU")).toBeInTheDocument();
    expect(screen.getByText("Only providers approved for trials can host your workloads")).toBeInTheDocument();
  });

  it("announces the trial has ended once no days remain", () => {
    setup({ trial: { daysLeft: 0, isExpired: true } });

    expect(screen.getByText("Your free trial has ended")).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("opens the add credits sheet from the purchase button", async () => {
    const AddCreditsSheet = vi.fn(() => <></>);
    setup({ dependencies: { AddCreditsSheet } });

    await userEvent.click(screen.getByRole("button", { name: "Purchase credits" }));

    expect(AddCreditsSheet).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, initialTab: "purchase" }), expect.anything());
  });

  function setup(input: { trial?: Partial<TrialStatus>; dependencies?: Partial<typeof DEPENDENCIES> } = {}) {
    const useTrialStatus = () =>
      mock<TrialStatus>({
        isTrialing: true,
        totalDays: 30,
        daysLeft: 18,
        daysElapsedPercent: 40,
        isExpired: false,
        deploymentDurationHours: 24,
        ...input.trial
      });

    return render(
      <TrialStatusPanel
        dependencies={{
          ...MockComponents(DEPENDENCIES, input.dependencies),
          Card: DEPENDENCIES.Card,
          CardContent: DEPENDENCIES.CardContent,
          CardHeader: DEPENDENCIES.CardHeader,
          Button: DEPENDENCIES.Button,
          Progress: DEPENDENCIES.Progress,
          useTrialStatus,
          ...input.dependencies
        }}
      />
    );
  }
});
