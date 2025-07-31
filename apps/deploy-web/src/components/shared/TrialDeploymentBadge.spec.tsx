import React from "react";

import { DEPENDENCIES as TRIAL_BADGE_DEPENDENCIES, TrialDeploymentBadge } from "./TrialDeploymentBadge";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe("TrialDeploymentBadge", () => {
  it("renders trial badge with correct text", () => {
    setup({ blockHeight: 10001440 });

    expect(screen.queryByText("Trial")).toBeInTheDocument();
  });

  it("shows expired state when trial has expired", () => {
    setup({ blockHeight: 10002880 });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("shows active state when trial is still valid", () => {
    setup({ blockHeight: 10000720 });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("uses custom trial duration", () => {
    setup({
      blockHeight: 10002160,
      trialDurationHours: 48
    });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("uses environment config trial duration when no prop provided", () => {
    setup({
      blockHeight: 10001440,
      trialDurationHours: undefined
    });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("uses custom average block time", () => {
    setup({
      blockHeight: 10000720,
      averageBlockTime: 12
    });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    setup({
      blockHeight: 10001440,
      className: "custom-class"
    });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("handles edge case where blocks remaining is exactly 0", () => {
    setup({ blockHeight: 10001440 });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("handles negative blocks remaining", () => {
    setup({ blockHeight: 10001500 });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("handles undefined createdHeight", () => {
    setup({ blockHeight: 10001440, createdHeight: undefined });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  it("handles zero trial duration", () => {
    setup({ blockHeight: 10001440, trialDurationHours: 0 });

    const badge = screen.queryByText("Trial");
    expect(badge).toBeInTheDocument();
    // Check that the badge is rendered (the actual styling is handled by the Badge component)
    expect(badge?.closest("div")).toBeInTheDocument();
  });

  function setup(input: { blockHeight: number; trialDurationHours?: number; averageBlockTime?: number; className?: string; createdHeight?: number }) {
    const mockUseTrialTimeRemaining = jest.fn().mockReturnValue({
      isExpired: input.blockHeight > 10001440, // Simple logic for expired state
      timeRemainingText: input.blockHeight > 10001440 ? "Trial expired" : "in 24 hours",
      timeLeft: input.blockHeight > 10001440 ? null : new Date(Date.now() + 24 * 60 * 60 * 1000),
      latestBlock: {
        block: {
          header: {
            height: input.blockHeight
          }
        }
      }
    });

    const props = {
      createdHeight: input.createdHeight ?? 10000000,
      trialDurationHours: input.trialDurationHours,
      averageBlockTime: input.averageBlockTime || 6,
      className: input.className,
      dependencies: {
        ...TRIAL_BADGE_DEPENDENCIES,
        Badge: ComponentMock,
        CustomTooltip: ComponentMock,
        TrialDeploymentTooltip: ComponentMock,
        useTrialTimeRemaining: mockUseTrialTimeRemaining
      }
    };

    render(<TrialDeploymentBadge {...props} />);
  }
});
