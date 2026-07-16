import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingSheetOptions } from "./BillingSheetProvider";
import { BillingSheetProvider, type DEPENDENCIES, useBillingSheet } from "./BillingSheetProvider";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(BillingSheetProvider.name, () => {
  it("keeps the sheet closed until a caller opens it", () => {
    const { getSheetProps } = setup();

    expect(getSheetProps().open).toBe(false);
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("opens the sheet when a caller calls open()", () => {
    const { getSheetProps } = setup();

    fireEvent.click(screen.getByRole("button", { name: "open" }));

    expect(getSheetProps().open).toBe(true);
    expect(screen.getByTestId("is-open")).toHaveTextContent("true");
  });

  it("forwards the initialTab and description options to the sheet", () => {
    const { getSheetProps } = setup({ options: { initialTab: "coupon", description: "Redeem a coupon" } });

    fireEvent.click(screen.getByRole("button", { name: "open" }));

    expect(getSheetProps().initialTab).toBe("coupon");
    expect(getSheetProps().description).toBe("Redeem a coupon");
  });

  it("closes the sheet when close() is called", () => {
    const { getSheetProps } = setup();

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    fireEvent.click(screen.getByRole("button", { name: "close" }));

    expect(getSheetProps().open).toBe(false);
    expect(screen.getByTestId("is-open")).toHaveTextContent("false");
  });

  it("closes the sheet when the sheet requests to close", () => {
    const { getSheetProps } = setup();

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    act(() => getSheetProps().onOpenChange(false));

    expect(getSheetProps().open).toBe(false);
  });

  it("runs the caller's onSuccess with the charge details and closes on a completed purchase", () => {
    const onSuccess = vi.fn();
    const { getSheetProps } = setup({ options: { onSuccess } });

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    act(() => getSheetProps().onDone(100, "Acme", 10));

    expect(onSuccess).toHaveBeenCalledWith(100, "Acme", 10);
    expect(getSheetProps().open).toBe(false);
  });

  it("runs the caller's onRedeemed and closes on a coupon redemption", () => {
    const onRedeemed = vi.fn();
    const { getSheetProps } = setup({ options: { onRedeemed } });

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    act(() => getSheetProps().onRedeemed!());

    expect(onRedeemed).toHaveBeenCalledTimes(1);
    expect(getSheetProps().open).toBe(false);
  });

  it("closes without error on a completed purchase when the caller passes no onSuccess", () => {
    const { getSheetProps } = setup();

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    act(() => getSheetProps().onDone(100));

    expect(getSheetProps().open).toBe(false);
  });

  it("marks the sheet wallet-ready from the managed wallet state", () => {
    const { getSheetProps } = setup({ hasManagedWallet: true });

    expect(getSheetProps().isWalletReady).toBe(true);
  });

  it("reacts to the managed wallet becoming ready while the sheet is open", () => {
    const { getSheetProps, setHasManagedWallet } = setup({ hasManagedWallet: false });

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(getSheetProps().isWalletReady).toBe(false);

    act(() => setHasManagedWallet(true));

    expect(getSheetProps().isWalletReady).toBe(true);
  });

  it("throws when useBillingSheet is used outside the provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<OrphanConsumer />)).toThrow("useBillingSheet must be used within a BillingSheetProvider");

    consoleSpy.mockRestore();
  });

  function OrphanConsumer() {
    useBillingSheet();
    return null;
  }

  function TestConsumer({ options }: { options?: BillingSheetOptions }) {
    const { open, close, isOpen } = useBillingSheet();
    return (
      <>
        <span data-testid="is-open">{String(isOpen)}</span>
        <button onClick={() => open(options)}>open</button>
        <button onClick={close}>close</button>
      </>
    );
  }

  function setup(input: { options?: BillingSheetOptions; hasManagedWallet?: boolean } = {}) {
    const AddCreditsSheet = vi.fn<typeof DEPENDENCIES.AddCreditsSheet>(() => <></>);
    const state = { hasManagedWallet: input.hasManagedWallet ?? false };
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ hasManagedWallet: state.hasManagedWallet });

    const buildUi = () => (
      <BillingSheetProvider dependencies={{ AddCreditsSheet, useWallet }}>
        <TestConsumer options={input.options} />
      </BillingSheetProvider>
    );
    const { rerender } = render(buildUi());

    return {
      getSheetProps: () => AddCreditsSheet.mock.calls.at(-1)![0],
      setHasManagedWallet: (value: boolean) => {
        state.hasManagedWallet = value;
        rerender(buildUi());
      }
    };
  }
});
