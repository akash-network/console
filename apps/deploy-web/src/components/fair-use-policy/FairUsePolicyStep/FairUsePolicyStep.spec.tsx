import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./FairUsePolicyStep";
import { FairUsePolicyStep } from "./FairUsePolicyStep";

import { fireEvent, render, screen } from "@testing-library/react";

describe(FairUsePolicyStep.name, () => {
  it("lists the prohibited workloads and accepts on the single action", () => {
    const { onAccept } = setup({ isAccepting: false });

    fireEvent.click(screen.getByTestId("fair-use-policy-accept-button"));

    expect(screen.getByText("Crypto miners")).toBeInTheDocument();
    expect(screen.getByText("Anything illegal")).toBeInTheDocument();
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it("disables the action while the acceptance is in flight", () => {
    setup({ isAccepting: true });

    expect(screen.getByTestId("fair-use-policy-accept-button")).toBeDisabled();
  });

  it("keeps the onboarding chrome above the prompt", () => {
    setup({ isAccepting: false });

    expect(screen.getByTestId("onboarding-header")).toBeInTheDocument();
  });

  it("exposes the prompt as a named region rather than a dialog", () => {
    setup({ isAccepting: false });

    expect(screen.getByRole("region", { name: /fair use policy/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  function setup(input: { isAccepting: boolean }) {
    const onAccept = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      OnboardingHeader: () => <header data-testid="onboarding-header" />
    };

    render(<FairUsePolicyStep onAccept={onAccept} isAccepting={input.isAccepting} dependencies={dependencies} />);

    return { onAccept };
  }
});
