import React from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./AutoTopUpSettingsPopup";
import { AutoTopUpSettingsPopup } from "./AutoTopUpSettingsPopup";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(AutoTopUpSettingsPopup.name, () => {
  it("prefills the default threshold and amount when no stored values are provided", () => {
    setup({});

    expect(thresholdInput().value).toBe("20");
    expect(amountInput().value).toBe("100");
  });

  it("prefills the stored threshold and amount when provided", () => {
    setup({ threshold: 30, amount: 250 });

    expect(thresholdInput().value).toBe("30");
    expect(amountInput().value).toBe("250");
  });

  it("renders the default payment method row", () => {
    setup({});

    expect(screen.getByText(/VISA •••• 5720/)).toBeInTheDocument();
    expect(screen.getByText(/Expires 5\/30/)).toBeInTheDocument();
  });

  it("blocks submit and shows an error when the amount is below the minimum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(amountInput(), { target: { value: "5" } });
    await submit();

    expect(screen.getByText(/Minimum amount is \$20/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("blocks submit and shows an error when the threshold is below the minimum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(thresholdInput(), { target: { value: "1" } });
    await submit();

    expect(screen.getByText(/Minimum threshold is \$5/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("blocks submit and shows an error when the amount is above the maximum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(amountInput(), { target: { value: "20000" } });
    await submit();

    expect(screen.getByText(/Maximum amount is \$10000/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("blocks submit and shows an error when the threshold is above the maximum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(thresholdInput(), { target: { value: "20000" } });
    await submit();

    expect(screen.getByText(/Maximum threshold is \$10000/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("saves the enabled flag with values in enable-on-save mode", async () => {
    const upsertMutate = vi.fn();
    setup({ enableOnSave: true, threshold: 20, amount: 100, upsertMutate });

    await submit();

    expect(upsertMutate).toHaveBeenCalledWith({ data: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 } }, expect.anything());
  });

  it("saves the enabled flag with values in edit mode", async () => {
    const upsertMutate = vi.fn();
    setup({ enableOnSave: false, threshold: 30, amount: 150, upsertMutate });

    await submit();

    expect(upsertMutate).toHaveBeenCalledWith({ data: { autoReloadEnabled: true, autoReloadThreshold: 30, autoReloadAmount: 150 } }, expect.anything());
  });

  it("closes and shows a success snackbar when the save succeeds", async () => {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const upsertMutate = vi.fn((_payload, options) => options?.onSuccess?.());
    setup({ onClose, enqueueSnackbar, upsertMutate });

    await submit();

    expect(enqueueSnackbar).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the dialog open and shows an error snackbar when the save fails", async () => {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const upsertMutate = vi.fn((_payload, options) => options?.onError?.());
    setup({ onClose, enqueueSnackbar, upsertMutate });

    await submit();

    expect(enqueueSnackbar).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("resets to the stored values when the dialog transitions from closed to open", () => {
    const { props, rerender } = setup({ open: false, threshold: 30, amount: 250 });

    rerender(<AutoTopUpSettingsPopup {...props} open threshold={40} amount={300} />);

    expect(thresholdInput().value).toBe("40");
    expect(amountInput().value).toBe("300");
  });

  it("keeps in-progress edits when the stored values change while the dialog stays open", () => {
    const { props, rerender } = setup({ open: true, threshold: 20, amount: 100 });

    fireEvent.change(amountInput(), { target: { value: "150" } });
    rerender(<AutoTopUpSettingsPopup {...props} amount={120} />);

    expect(amountInput().value).toBe("150");
  });

  function thresholdInput() {
    return screen.getByLabelText(/when credit balance goes below/i) as HTMLInputElement;
  }

  function amountInput() {
    return screen.getByLabelText(/purchase this amount/i) as HTMLInputElement;
  }

  async function submit() {
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: /save changes/i }).closest("form")!);
    });
  }

  function setup(input: {
    open?: boolean;
    enableOnSave?: boolean;
    threshold?: number;
    amount?: number;
    onClose?: () => void;
    enqueueSnackbar?: ReturnType<typeof vi.fn>;
    upsertMutate?: ReturnType<typeof vi.fn>;
    isPending?: boolean;
  }) {
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () =>
      ({ enqueueSnackbar: input.enqueueSnackbar ?? vi.fn(), closeSnackbar: vi.fn() }) as unknown as ReturnType<typeof DEPENDENCIES.useSnackbar>;

    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ topUpMinAmountUsd: 20 });

    const paymentMethod = mock<PaymentMethod>({
      card: { brand: "visa", last4: "5720", exp_month: 5, exp_year: 30 } as PaymentMethod["card"]
    });
    const useDefaultPaymentMethodQuery: typeof DEPENDENCIES.useDefaultPaymentMethodQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDefaultPaymentMethodQuery>>({ data: paymentMethod });

    const useWalletSettingsMutations: typeof DEPENDENCIES.useWalletSettingsMutations = () =>
      ({
        upsertWalletSettings: { mutate: input.upsertMutate ?? vi.fn(), isPending: input.isPending ?? false }
      }) as unknown as ReturnType<typeof DEPENDENCIES.useWalletSettingsMutations>;

    const dependencies = {
      useForm,
      zodResolver,
      useSnackbar,
      useWallet,
      useDefaultPaymentMethodQuery,
      useWalletSettingsMutations
    };

    const props = {
      open: input.open ?? true,
      onClose: input.onClose ?? vi.fn(),
      enableOnSave: input.enableOnSave ?? false,
      threshold: input.threshold,
      amount: input.amount,
      dependencies
    };

    const utils = render(<AutoTopUpSettingsPopup {...props} />);

    return { ...utils, props };
  }
});
