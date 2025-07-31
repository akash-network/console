import React from "react";

import { ServicesProvider } from "@src/context/ServicesProvider";
import { DEPENDENCIES as TRIAL_TOOLTIP_DEPENDENCIES, TrialDeploymentTooltip } from "./TrialDeploymentTooltip";

import { render, screen } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

describe("TrialDeploymentTooltip", () => {
  it("renders trial deployment info when no created height", () => {
    setup({ createdHeight: undefined });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText(/Trial deployments are automatically closed after/)).toBeInTheDocument();
    expect(screen.getByText("Add Funds")).toBeInTheDocument();
  });

  it("displays correct trial duration in hours when no created height", () => {
    setup({ createdHeight: undefined, trialDuration: 24 });

    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "Trial deployments are automatically closed after 24 hours.";
      })
    ).toBeInTheDocument();
  });

  it("renders expired state message when trial has expired", () => {
    setup({ createdHeight: 10000000, isExpired: true });

    expect(screen.getByText("This trial deployment has expired and will be closed automatically.")).toBeInTheDocument();
    expect(screen.getByText("Add Funds")).toBeInTheDocument();
  });

  it("renders active trial state with time remaining", () => {
    setup({ createdHeight: 10000000, timeRemainingText: "2 hours 30 minutes" });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
    expect(screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("Add funds to activate your account.")).toBeInTheDocument();
    expect(screen.getByText("Add Funds")).toBeInTheDocument();
  });

  it("displays correct trial duration in active state", () => {
    setup({ createdHeight: 10000000, trialDuration: 48 });

    expect(
      screen.getByText((content, element) => {
        return element?.textContent === "Trial deployments are automatically closed after 48 hours.";
      })
    ).toBeInTheDocument();
  });

  it("renders Add Funds button", () => {
    setup({ createdHeight: 10000000 });

    const addFundsButton = screen.getByText("Add Funds");
    expect(addFundsButton).toBeInTheDocument();
  });

  it("renders HandCard icon in Add Funds button", () => {
    setup({ createdHeight: 10000000 });

    // The HandCard icon is rendered as an SVG, so we can check for its presence
    const addFundsButton = screen.getByText("Add Funds");
    expect(addFundsButton).toBeInTheDocument();

    // Check that the SVG icon is present (HandCard renders as an SVG)
    const svgIcon = addFundsButton.closest("div")?.querySelector("svg");
    expect(svgIcon).toBeInTheDocument();
  });

  it("handles null time remaining text gracefully", () => {
    setup({ createdHeight: 10000000, timeRemainingText: null });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("handles empty time remaining text gracefully", () => {
    setup({ createdHeight: 10000000, timeRemainingText: "" });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
    // The empty span should be present but not contain any text
    const timeRemainingSpan = screen.getByText("Time remaining:").closest("p")?.querySelector("span");
    expect(timeRemainingSpan).toHaveClass("font-medium", "text-primary");
    expect(timeRemainingSpan?.textContent).toBe("");
  });

  it("handles zero trial duration", () => {
    setup({ createdHeight: 10000000, trialDuration: 0 });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
    expect(screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles very large trial duration", () => {
    setup({ createdHeight: 10000000, trialDuration: 999999 });

    expect(screen.getByText("Trial Deployment")).toBeInTheDocument();
    expect(screen.getByText("Time remaining:")).toBeInTheDocument();
    expect(screen.getByText("2 hours 30 minutes")).toBeInTheDocument();
    expect(screen.getByText("999999")).toBeInTheDocument();
  });

  function setup(input: {
    createdHeight?: number;
    isExpired?: boolean;
    timeRemainingText?: string | null;
    trialDuration?: number;
    dependencies?: typeof TRIAL_TOOLTIP_DEPENDENCIES;
  }) {
    const props = {
      createdHeight: input.createdHeight,
      isExpired: input.isExpired ?? false,
      timeRemainingText: input.timeRemainingText ?? "2 hours 30 minutes",
      trialDuration: input.trialDuration ?? 24,
      dependencies: input.dependencies ?? {
        ...TRIAL_TOOLTIP_DEPENDENCIES,
        AddFundsLink: ComponentMock
      }
    };

    return render(
      <ServicesProvider>
        <TrialDeploymentTooltip {...props} />
      </ServicesProvider>
    );
  }
});
