import { describe, expect, it, vi } from "vitest";

import { PhasedDeploymentProgress } from "./PhasedDeploymentProgress";

import { fireEvent, render, screen } from "@testing-library/react";

type Props = Parameters<typeof PhasedDeploymentProgress>[0];
type Phases = Props["phases"];

const TYPICAL_DEPLOY_MESSAGE =
  "We'll pick the best host for you. Typical deploys take 15–30 seconds. When your deployment is ready, we'll automatically redirect you.";

const WAITING_FOR_LATE_BIDS_MESSAGE =
  "Providers are busy right now, so this is taking longer than usual. We'll keep waiting and pick a provider as soon as one bids.";

const PHASES: Phases = [
  { id: "creating", label: "Creating", status: "completed" },
  { id: "matching", label: "Matching", status: "active" },
  { id: "preparing", label: "Preparing", status: "pending" }
];

describe(PhasedDeploymentProgress.name, () => {
  describe("when state is error", () => {
    it("renders the failure heading with the template name", () => {
      setup({ state: { kind: "error" }, templateName: "my-app" });

      expect(screen.getByText("We couldn't deploy my-app")).toBeInTheDocument();
    });

    it("renders the provided error message", () => {
      setup({ state: { kind: "error", message: "Provider rejected the bid" } });

      expect(screen.getByText("Provider rejected the bid")).toBeInTheDocument();
    });

    it("renders a fallback message when none is provided", () => {
      setup({ state: { kind: "error" } });

      expect(screen.getByText(/Something went wrong while creating your deployment/)).toBeInTheDocument();
    });

    it("does not render the progress bar", () => {
      setup({ state: { kind: "error" } });

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("invokes onTryAgain when Try again is clicked", () => {
      const onTryAgain = vi.fn();
      setup({ state: { kind: "error" }, onTryAgain });

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onTryAgain).toHaveBeenCalledTimes(1);
    });

    it("invokes onContactSupport when Contact support is clicked", () => {
      const onContactSupport = vi.fn();
      setup({ state: { kind: "error" }, onContactSupport });

      fireEvent.click(screen.getByRole("button", { name: "Contact support" }));

      expect(onContactSupport).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the balance cannot cover the deployment", () => {
    it("asks the user to add funds to deploy the template", () => {
      setup({ state: { kind: "error", reason: "needs-funds" }, templateName: "my-app" });

      expect(screen.getByText("Add funds to deploy my-app")).toBeInTheDocument();
    });

    it("says how far the balance falls short", () => {
      setup({ state: { kind: "error", reason: "needs-funds", shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0.12 } } });

      expect(screen.getByText("Starting this deployment takes $0.50 and your balance has $0.12, so you're $0.38 short.")).toBeInTheDocument();
    });

    it("falls back to the refusal's own message when no amounts were reported", () => {
      setup({ state: { kind: "error", reason: "needs-funds", message: "Not enough balance to cover the deployment deposit." } });

      expect(screen.getByText("Not enough balance to cover the deployment deposit.")).toBeInTheDocument();
    });

    it("opens add credits when Add funds is clicked", () => {
      const onAddFunds = vi.fn();
      setup({ state: { kind: "error", reason: "needs-funds" }, onAddFunds });

      fireEvent.click(screen.getByRole("button", { name: "Add funds" }));

      expect(onAddFunds).toHaveBeenCalledTimes(1);
    });

    it("keeps Try again so the same deployment can be retried once the funds land", () => {
      const onTryAgain = vi.fn();
      setup({ state: { kind: "error", reason: "needs-funds" }, onTryAgain });

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onTryAgain).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the project is at its monthly budget", () => {
    it("explains the refusal in its own words, whatever the api said", () => {
      setup({ state: { kind: "error", reason: "budget-exceeded", message: "It was not signed." } });

      expect(screen.getByText("This project is at its monthly budget")).toBeInTheDocument();
      expect(
        screen.getByText("Starting this deployment would take the project past its monthly budget. An owner or admin can raise the budget.")
      ).toBeInTheDocument();
      expect(screen.queryByText("It was not signed.")).not.toBeInTheDocument();
    });

    it("takes those who can change the budget to the project, keeping Try again", () => {
      const onViewProject = vi.fn();
      const onTryAgain = vi.fn();
      setup({ state: { kind: "error", reason: "budget-exceeded" }, onViewProject, onTryAgain, onContactSupport: vi.fn() });

      fireEvent.click(screen.getByRole("button", { name: "View project" }));
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onViewProject).toHaveBeenCalledTimes(1);
      expect(onTryAgain).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Contact support" })).not.toBeInTheDocument();
    });

    it("offers the usual way out to those who cannot change the budget", () => {
      setup({ state: { kind: "error", reason: "budget-exceeded" } });

      expect(screen.queryByRole("button", { name: "View project" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
    });
  });

  describe("when the lease failed with no provider left to try on its own", () => {
    it("sends the user to the bids to pick another provider, keeping Try again to start over", () => {
      const onTryAnotherProvider = vi.fn();
      const onTryAgain = vi.fn();
      setup({ state: { kind: "error", reason: "lease-failed" }, onTryAnotherProvider, onTryAgain, onContactSupport: vi.fn() });

      fireEvent.click(screen.getByRole("button", { name: "Try another provider" }));
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onTryAnotherProvider).toHaveBeenCalledTimes(1);
      expect(onTryAgain).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Contact support" })).not.toBeInTheDocument();
    });

    it("shows the reason the api gave", () => {
      setup({ state: { kind: "error", reason: "lease-failed", message: "Provider could not be reached." }, onTryAnotherProvider: vi.fn() });

      expect(screen.getByText("We couldn't deploy test-template")).toBeInTheDocument();
      expect(screen.getByText("Provider could not be reached.")).toBeInTheDocument();
    });

    it("points at the bids when the api gave no reason", () => {
      setup({ state: { kind: "error", reason: "lease-failed" }, onTryAnotherProvider: vi.fn() });

      expect(
        screen.getByText("The provider couldn't start your deployment. Pick another provider from the bids you received, or try again from the start.")
      ).toBeInTheDocument();
    });

    it("offers the usual way out where there are no bids to go to", () => {
      setup({ state: { kind: "error", reason: "lease-failed" } });

      expect(screen.queryByRole("button", { name: "Try another provider" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
    });
  });

  describe("when a top up is already on its way", () => {
    it("asks the user to wait for the top up", () => {
      setup({ state: { kind: "error", reason: "top-up-pending" } });

      expect(screen.getByText("Your balance is being topped up")).toBeInTheDocument();
      expect(screen.getByText("A top up from your saved payment method is on the way. Try again in a moment.")).toBeInTheDocument();
    });

    it("does not send the user to add funds", () => {
      setup({ state: { kind: "error", reason: "top-up-pending" }, onAddFunds: vi.fn() });

      expect(screen.queryByRole("button", { name: "Add funds" })).not.toBeInTheDocument();
    });

    it("invokes onTryAgain when Try again is clicked", () => {
      const onTryAgain = vi.fn();
      setup({ state: { kind: "error", reason: "top-up-pending" }, onTryAgain });

      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(onTryAgain).toHaveBeenCalledTimes(1);
    });
  });

  describe("when state is in progress", () => {
    it("renders the deploying heading with the template name", () => {
      setup({ templateName: "my-app" });

      expect(screen.getByText("Deploying my-app")).toBeInTheDocument();
    });

    it("renders each phase label", () => {
      setup();

      expect(screen.getByText("Creating")).toBeInTheDocument();
      expect(screen.getByText("Matching")).toBeInTheDocument();
      expect(screen.getByText("Preparing")).toBeInTheDocument();
    });

    it("tells the user how long a deploy usually takes", () => {
      setup({ state: { kind: "matching" } });

      expect(screen.getByText(TYPICAL_DEPLOY_MESSAGE)).toBeInTheDocument();
    });

    it("tells the user providers are busy while it keeps waiting for a late bid", () => {
      setup({ state: { kind: "matching", isWaitingForLateBids: true } });

      expect(screen.getByText(WAITING_FOR_LATE_BIDS_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(TYPICAL_DEPLOY_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe("choosing the provider by hand", () => {
    it("offers it once bids are in, handing off when chosen", () => {
      const onChooseProvider = vi.fn();
      setup({ state: { kind: "matching", hasBids: true }, onChooseProvider });

      expect(screen.getByText("Want to choose the provider yourself?")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Choose my provider" }));

      expect(onChooseProvider).toHaveBeenCalledTimes(1);
    });

    it("holds it back while providers have not bid yet", () => {
      setup({ state: { kind: "matching", hasBids: false }, onChooseProvider: vi.fn() });

      expect(screen.queryByRole("button", { name: "Choose my provider" })).not.toBeInTheDocument();
      expect(screen.queryByText("Want to choose the provider yourself?")).not.toBeInTheDocument();
    });

    it("holds it back while the deployment is still being created", () => {
      setup({ state: { kind: "creating", hasBids: true }, onChooseProvider: vi.fn() });

      expect(screen.queryByRole("button", { name: "Choose my provider" })).not.toBeInTheDocument();
    });

    it("takes it away once a provider is being leased", () => {
      setup({ state: { kind: "preparing", hasBids: true }, onChooseProvider: vi.fn() });

      expect(screen.queryByRole("button", { name: "Choose my provider" })).not.toBeInTheDocument();
    });
  });

  describe("progress bar", () => {
    it("exposes the rounded progress percent via aria-valuenow", () => {
      setup({ progressPercent: 42.6 });

      expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "43");
    });

    it("clamps values above 100", () => {
      setup({ progressPercent: 150 });

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "100");
      expect(progressbar).toHaveStyle({ width: "100%" });
    });

    it("clamps negative values to 0", () => {
      setup({ progressPercent: -20 });

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar).toHaveAttribute("aria-valuenow", "0");
      expect(progressbar).toHaveStyle({ width: "0%" });
    });
  });

  describe("phase checkpoints", () => {
    it("labels checkpoints according to each phase status", () => {
      setup();

      expect(screen.getByLabelText("Completed")).toBeInTheDocument();
      expect(screen.getByLabelText("Active")).toBeInTheDocument();
      expect(screen.getByLabelText("Pending")).toBeInTheDocument();
    });

    it("renders one checkpoint per phase", () => {
      setup({
        phases: [
          { id: "creating", label: "Creating", status: "pending" },
          { id: "matching", label: "Matching", status: "pending" },
          { id: "preparing", label: "Preparing", status: "pending" }
        ]
      });

      expect(screen.getAllByLabelText("Pending")).toHaveLength(3);
    });
  });

  function setup(input?: Partial<Props>) {
    return render(
      <PhasedDeploymentProgress
        state={input?.state ?? { kind: "creating" }}
        templateName={input?.templateName ?? "test-template"}
        progressPercent={input?.progressPercent ?? 0}
        phases={input?.phases ?? PHASES}
        onChooseProvider={input?.onChooseProvider}
        onTryAgain={input?.onTryAgain}
        onTryAnotherProvider={input?.onTryAnotherProvider}
        onContactSupport={input?.onContactSupport}
        onAddFunds={input?.onAddFunds}
        onViewProject={input?.onViewProject}
      />
    );
  }
});
