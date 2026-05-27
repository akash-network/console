import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { AddCreditsSheet, DEPENDENCIES } from "./AddCreditsSheet";

import { act, render } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AddCreditsSheet.name, () => {
  it("renders the AddCreditsForm when open", () => {
    const { dependencies } = setup({ open: true });

    expect(dependencies.AddCreditsForm).toHaveBeenCalled();
  });

  it("does not render the AddCreditsForm while closed", () => {
    const { dependencies } = setup({ open: false });

    expect(dependencies.AddCreditsForm).not.toHaveBeenCalled();
  });

  it("forwards onDone to the form", () => {
    const onDone = vi.fn();
    const { dependencies } = setup({ open: true, onDone });

    expect(dependencies.AddCreditsForm).toHaveBeenCalledWith(expect.objectContaining({ onDone }), expect.anything());
  });

  it("forwards isWalletReady to the form", () => {
    const { dependencies } = setup({ open: true, isWalletReady: false });

    expect(dependencies.AddCreditsForm).toHaveBeenCalledWith(expect.objectContaining({ isWalletReady: false }), expect.anything());
  });

  it("blocks closing while the form reports a payment in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsForm: reportingForm(true) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("allows closing when no payment is in progress", () => {
    const onOpenChange = vi.fn();
    const { dependencies } = setup({ open: true, onOpenChange, dependencies: { AddCreditsForm: reportingForm(false) } });

    act(() => dependencies.Sheet.mock.calls.at(-1)![0].onOpenChange?.(false));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides the close button while the form reports a payment in progress", () => {
    const { dependencies } = setup({ open: true, dependencies: { AddCreditsForm: reportingForm(true) } });

    expect(dependencies.SheetContent.mock.calls.at(-1)![0].hideCloseButton).toBe(true);
  });

  function reportingForm(isProcessing: boolean) {
    return ({ onProcessingChange }: Parameters<typeof DEPENDENCIES.AddCreditsForm>[0]) => {
      useEffect(() => onProcessingChange?.(isProcessing), [onProcessingChange]);
      return <></>;
    };
  }

  function setup(input: {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    onDone?: (amount: number, organization?: string) => void;
    isWalletReady?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const dependencies = MockComponents(DEPENDENCIES, input.dependencies);

    render(
      <AddCreditsSheet
        open={input.open}
        onOpenChange={input.onOpenChange ?? vi.fn()}
        onDone={input.onDone ?? vi.fn()}
        isWalletReady={input.isWalletReady}
        dependencies={dependencies}
      />
    );

    return { dependencies };
  }
});
