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

    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", {
      category: "onboarding",
      control: "skip_button",
      discardedDeployment: false,
      midLease: false,
      deploymentKeepsGoing: false
    });
  });

  it("skips without asking while the lease is in flight, keeping the deployment, and tracks leaving mid-lease", () => {
    const { skip, discard, analyticsService } = setup({ source: "auto_deploy", isLeaseInFlight: true, keepsDeployingWithoutPage: true });

    fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(discard).not.toHaveBeenCalled();
    expect(skip).toHaveBeenCalledWith("auto_deploy");
    expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", {
      category: "onboarding",
      control: "skip_button",
      discardedDeployment: false,
      midLease: true,
      deploymentKeepsGoing: true
    });
  });

  it("tells the user the deployment keeps going when it goes on without the page", () => {
    const { skip, discard, enqueueSnackbar } = setup({ source: "auto_deploy", keepsDeployingWithoutPage: true });

    fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(discard).not.toHaveBeenCalled();
    expect(skip).toHaveBeenCalledWith("auto_deploy");
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: {
          title: "Your deployment keeps going",
          subTitle: "Skipping onboarding doesn't stop it. You'll find it in Deployments.",
          iconVariant: "info"
        }
      }),
      { variant: "info" }
    );
  });

  it("says nothing about a deployment when there is none to keep going", () => {
    const { enqueueSnackbar } = setup({ source: "picker" });

    fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));

    expect(enqueueSnackbar).not.toHaveBeenCalled();
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
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", {
        category: "onboarding",
        control: "skip_button",
        discardedDeployment: true,
        midLease: false,
        deploymentKeepsGoing: false
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("keeps a deployment that got its lease while the dialog was open", async () => {
      const { skip, discard, analyticsService, rerenderWith } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });
      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));
      rerenderWith({ holdsUnleasedDeployment: false });

      await userEvent.click(screen.getByRole("button", { name: "Skip anyway" }));

      expect(discard).not.toHaveBeenCalled();
      expect(skip).toHaveBeenCalledWith("auto_deploy");
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", {
        category: "onboarding",
        control: "skip_button",
        discardedDeployment: false,
        midLease: false,
        deploymentKeepsGoing: false
      });
    });

    it("keeps a deployment whose lease went out while the dialog was open, and tracks leaving mid-lease", async () => {
      const { skip, discard, analyticsService, rerenderWith } = setup({ source: "auto_deploy", holdsUnleasedDeployment: true });
      fireEvent.click(screen.getByRole("button", { name: "Skip onboarding - Explore Console" }));
      rerenderWith({ holdsUnleasedDeployment: false, isLeaseInFlight: true, keepsDeployingWithoutPage: true });

      await userEvent.click(screen.getByRole("button", { name: "Skip anyway" }));

      expect(discard).not.toHaveBeenCalled();
      expect(skip).toHaveBeenCalledWith("auto_deploy");
      expect(analyticsService.track).toHaveBeenCalledWith("onboarding_left", {
        category: "onboarding",
        control: "skip_button",
        discardedDeployment: false,
        midLease: true,
        deploymentKeepsGoing: true
      });
    });
  });

  function setup(input: {
    source: SkipOnboardingSource;
    isSkipping?: boolean;
    isCreating?: boolean;
    holdsUnleasedDeployment?: boolean;
    isLeaseInFlight?: boolean;
    keepsDeployingWithoutPage?: boolean;
  }) {
    const skip = vi.fn(async () => {});
    const discard = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const enqueueSnackbar = vi.fn();
    const Snackbar = vi.fn(() => null);
    const dependenciesWith = (guard: {
      holdsUnleasedDeployment: boolean;
      isLeaseInFlight?: boolean;
      keepsDeployingWithoutPage?: boolean;
    }): typeof DEPENDENCIES => ({
      useSkipOnboarding: () => mock<ReturnType<typeof DEPENDENCIES.useSkipOnboarding>>({ skip, isSkipping: input.isSkipping ?? false }),
      useDeploymentLeaveGuard: () => ({
        isCreating: input.isCreating ?? false,
        holdsUnleasedDeployment: guard.holdsUnleasedDeployment,
        isLeaseInFlight: guard.isLeaseInFlight ?? false,
        keepsDeployingWithoutPage: guard.keepsDeployingWithoutPage ?? false,
        discard
      }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar
    });

    const { rerender } = render(
      <SkipOnboardingButton
        source={input.source}
        dependencies={dependenciesWith({
          holdsUnleasedDeployment: input.holdsUnleasedDeployment ?? false,
          isLeaseInFlight: input.isLeaseInFlight,
          keepsDeployingWithoutPage: input.keepsDeployingWithoutPage
        })}
      />
    );
    const rerenderWith = (guard: { holdsUnleasedDeployment: boolean; isLeaseInFlight?: boolean; keepsDeployingWithoutPage?: boolean }) =>
      rerender(<SkipOnboardingButton source={input.source} dependencies={dependenciesWith(guard)} />);

    return { skip, discard, analyticsService, enqueueSnackbar, rerenderWith };
  }
});
