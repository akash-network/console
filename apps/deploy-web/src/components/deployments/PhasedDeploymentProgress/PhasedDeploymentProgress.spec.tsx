import { describe, expect, it, vi } from "vitest";

import { PhasedDeploymentProgress } from "./PhasedDeploymentProgress";

import { fireEvent, render, screen } from "@testing-library/react";

type Props = Parameters<typeof PhasedDeploymentProgress>[0];
type Phases = Props["phases"];

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

  describe("choose provider", () => {
    it("invokes onChooseProvider when the button is clicked", () => {
      const onChooseProvider = vi.fn();
      setup({ onChooseProvider });

      fireEvent.click(screen.getByRole("button", { name: /Choose my provider/ }));

      expect(onChooseProvider).toHaveBeenCalledTimes(1);
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
        onContactSupport={input?.onContactSupport}
      />
    );
  }
});
