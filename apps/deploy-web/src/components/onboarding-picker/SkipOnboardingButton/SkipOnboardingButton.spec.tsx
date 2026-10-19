import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DEPENDENCIES } from "./SkipOnboardingButton";
import { SkipOnboardingButton } from "./SkipOnboardingButton";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(SkipOnboardingButton.name, () => {
  it("skips with the given source when clicked", () => {
    const { skip } = setup({ source: "picker" });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(skip).toHaveBeenCalledWith("picker");
  });

  it("forwards the auto_deploy source when clicked", () => {
    const { skip } = setup({ source: "auto_deploy" });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(skip).toHaveBeenCalledWith("auto_deploy");
  });

  it("tracks leaving onboarding through the skip button with nothing discarded", () => {
    const { analyticsService } = setup({ source: "auto_deploy" });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", { category: "onboarding", control: "skip_button", discardedDeployment: false });
  });

  it("disables the button while a skip is in progress", () => {
    setup({ source: "picker", isSkipping: true });

    expect(screen.getByRole("button", { name: /skip/i })).toBeDisabled();
  });

  it("stays out of the way while a deployment is being created", () => {
    setup({ source: "auto_deploy", isCreating: true });

    expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
  });

  describe("when the flow holds a deployment no lease holds yet", () => {
    it("asks before skipping instead of leaving the deployment behind", () => {
      const { skip, discard, analyticsService } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });

      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));

      expect(screen.getByRole("dialog", { name: "Skip onboarding and discard this deployment?" })).toHaveAccessibleDescription(
        "Skipping closes the deployment you just started, along with any bids providers have sent for it."
      );
      expect(skip).not.toHaveBeenCalled();
      expect(discard).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
    });

    it("keeps deploying when the skip is declined", async () => {
      const { skip, discard } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });

      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));
      await userEvent.click(screen.getByRole("button", { name: "Keep deploying" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(skip).not.toHaveBeenCalled();
      expect(discard).not.toHaveBeenCalled();
    });

    it("discards the deployment, skips and tracks the discard when the user skips anyway", async () => {
      const { skip, discard, analyticsService } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });

      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));
      await userEvent.click(screen.getByRole("button", { name: "Skip anyway" }));

      expect(discard).toHaveBeenCalled();
      expect(skip).toHaveBeenCalledWith("auto_deploy");
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", { category: "onboarding", control: "skip_button", discardedDeployment: true });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps a deployment that got its lease while the dialog was open", async () => {
      const { skip, discard, analyticsService, rerenderWith } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });
      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));
      rerenderWith({ holdsUnleasedDeployment: false });

      await userEvent.click(screen.getByRole("button", { name: "Skip anyway" }));

      expect(discard).not.toHaveBeenCalled();
      expect(skip).toHaveBeenCalledWith("auto_deploy");
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", { category: "onboarding", control: "skip_button", discardedDeployment: false });
    });
  });

  function setup(input: { source: SkipOnboardingSource; isSkipping?: boolean; isCreating?: boolean; holdsUnleasedDeployment?: boolean }) {
    const skip = vi.fn(async () => {});
    const discard = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const dependenciesWith = (guard: { holdsUnleasedDeployment: boolean }): typeof DEPENDENCIES => ({
      useSkipOnboarding: () => mock<ReturnType<typeof DEPENDENCIES.useSkipOnboarding>>({ skip, isSkipping: input.isSkipping ?? false }),
      useDeploymentLeaveGuard: () => ({ isCreating: input.isCreating ?? false, holdsUnleasedDeployment: guard.holdsUnleasedDeployment, discard }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    });

    const { rerender } = render(
      <SkipOnboardingButton source={input.source} dependencies={dependenciesWith({ holdsUnleasedDeployment: input.holdsUnleasedDeployment ?? false })} />
    );
    const rerenderWith = (guard: { holdsUnleasedDeployment: boolean }) =>
      rerender(<SkipOnboardingButton source={input.source} dependencies={dependenciesWith(guard)} />);

    return { skip, discard, analyticsService, rerenderWith };
  }
});
