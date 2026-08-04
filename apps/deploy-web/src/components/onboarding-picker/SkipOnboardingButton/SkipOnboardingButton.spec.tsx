import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SkipOnboardingSource } from "@src/hooks/useSkipOnboarding";
import type { DEPENDENCIES } from "./SkipOnboardingButton";
import { SkipOnboardingButton } from "./SkipOnboardingButton";

import { fireEvent, render, screen } from "@testing-library/react";

describe(SkipOnboardingButton.name, () => {
  it("skips with the given source when clicked", () => {
    const skip = vi.fn();
    setup({ source: "picker", skip });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(skip).toHaveBeenCalledWith("picker");
  });

  it("forwards the auto_deploy source when clicked", () => {
    const skip = vi.fn();
    setup({ source: "auto_deploy", skip });

    fireEvent.click(screen.getByRole("button", { name: /skip/i }));

    expect(skip).toHaveBeenCalledWith("auto_deploy");
  });

  it("disables the button while a skip is in progress", () => {
    setup({ source: "picker", isSkipping: true });

    expect(screen.getByRole("button", { name: /skip/i })).toBeDisabled();
  });

  function setup(input: { source: SkipOnboardingSource; skip?: () => Promise<void>; isSkipping?: boolean }) {
    const skip = input.skip ?? vi.fn();
    const useSkipOnboarding: typeof DEPENDENCIES.useSkipOnboarding = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSkipOnboarding>>({ skip, isSkipping: input.isSkipping ?? false });

    return render(<SkipOnboardingButton source={input.source} dependencies={{ useSkipOnboarding }} />);
  }
});
