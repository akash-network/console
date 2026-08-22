import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./RuntimeLimitSection";
import { MAX_RUNTIME_LIMIT_HOURS, RuntimeLimitSection } from "./RuntimeLimitSection";

import { fireEvent, render, screen } from "@testing-library/react";

describe(RuntimeLimitSection.name, () => {
  it("renders nothing when the feature flag is off", () => {
    setup({ isFlagEnabled: false });
    expect(screen.queryByLabelText("Runtime limit in hours")).not.toBeInTheDocument();
  });

  it("renders nothing for a trial user", () => {
    setup({ isRestricted: true });
    expect(screen.queryByLabelText("Runtime limit in hours")).not.toBeInTheDocument();
  });

  it("shows the current value in hours", () => {
    setup({ value: 12 });
    expect(screen.getByLabelText("Runtime limit in hours")).toHaveValue(12);
  });

  it("reports whole hours through onChange", () => {
    const { onChange } = setup({});
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "6" } });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("reports an emptied input as no limit", () => {
    const { onChange } = setup({ value: 6 });
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("floors a fractional input to whole hours", () => {
    const { onChange } = setup({});
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "2.7" } });
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("caps the input at one year of hours", () => {
    const { onChange } = setup({});
    fireEvent.change(screen.getByLabelText("Runtime limit in hours"), { target: { value: "99999" } });
    expect(onChange).toHaveBeenCalledWith(MAX_RUNTIME_LIMIT_HOURS);
  });

  it("disables the input while locked", () => {
    setup({ locked: true });
    expect(screen.getByLabelText("Runtime limit in hours")).toBeDisabled();
  });

  function setup(input: { value?: number; locked?: boolean; isFlagEnabled?: boolean; isRestricted?: boolean }) {
    const onChange = vi.fn();
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isFlagEnabled ?? true;
    const useTrialGate: typeof DEPENDENCIES.useTrialGate = () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true });

    render(
      <TooltipProvider>
        <RuntimeLimitSection value={input.value} onChange={onChange} locked={input.locked} dependencies={{ useFlag, useTrialGate }} />
      </TooltipProvider>
    );

    return { onChange };
  }
});
