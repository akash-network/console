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

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-destructive");
  });

  it("shows active state when trial is still valid", () => {
    setup({ blockHeight: 10000720 });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-secondary");
  });

  it("uses custom trial duration", () => {
    setup({
      blockHeight: 10002160,
      trialDurationHours: 48
    });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-secondary");
  });

  it("uses custom average block time", () => {
    setup({
      blockHeight: 10000720,
      averageBlockTime: 12
    });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-destructive");
  });

  it("applies custom className", () => {
    setup({
      blockHeight: 10001440,
      className: "custom-class"
    });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("custom-class");
  });

  it("handles edge case where blocks remaining is exactly 0", () => {
    setup({ blockHeight: 10001440 });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-destructive");
  });

  it("handles negative blocks remaining", () => {
    setup({ blockHeight: 10001500 });

    const badge = screen.queryByText("Trial")?.closest("div");
    expect(badge).toHaveClass("bg-destructive");
  });

  function setup(input: { blockHeight: number; trialDurationHours?: number; averageBlockTime?: number; className?: string }) {
    const mockUseBlock = jest.fn().mockReturnValue({
      data: {
        block: {
          header: {
            height: input.blockHeight
          }
        }
      }
    });

    const MockInfo = React.forwardRef<SVGSVGElement, any>((props, ref) => {
      return <svg ref={ref} {...props} />;
    });
    MockInfo.displayName = "Info";

    const props = {
      createdHeight: 10000000,
      trialDurationHours: input.trialDurationHours || 24,
      averageBlockTime: input.averageBlockTime || 6,
      className: input.className,
      dependencies: {
        ...TRIAL_BADGE_DEPENDENCIES,
        Badge: ComponentMock,
        CustomTooltip: ComponentMock,
        Info: MockInfo,
        useBlock: mockUseBlock
      }
    };

    render(<TrialDeploymentBadge {...props} />);
  }
});
