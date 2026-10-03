import React from "react";
import { useForm } from "react-hook-form";
import type { PaymentMethod } from "@akashnetwork/http-sdk";
import { describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./AutoRechargeSettingsPopup";
import { AutoRechargeSettingsPopup } from "./AutoRechargeSettingsPopup";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(AutoRechargeSettingsPopup.name, () => {
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

  it("calls the dialog auto recharge settings", () => {
    setup({});

    expect(screen.getByText("Auto recharge settings")).toBeInTheDocument();
    expect(screen.queryByText(/top-up settings/i)).not.toBeInTheDocument();
  });

  it("renders the default payment method row with its brand mark", () => {
    setup({});

    expect(screen.getByText(/VISA •••• 5720/)).toBeInTheDocument();
    expect(screen.getByText(/Expires 5\/30/)).toBeInTheDocument();
    expect(screen.getByTestId("card-brand-mark")).toHaveTextContent("visa");
  });

  it("estimates a week of spend in prediction mode", () => {
    const { useWeeklyDeploymentCostQuery } = setup({ mode: "prediction", weeklyCost: 3731.28 });

    expect(screen.getByLabelText("Estimated weekly recharge")).toHaveTextContent("3731.28");
    expect(useWeeklyDeploymentCostQuery).toHaveBeenLastCalledWith({ enabled: true });
  });

  it("holds the estimate back while the weekly cost loads", () => {
    setup({ mode: "prediction", isWeeklyCostLoading: true });

    expect(screen.queryByLabelText("Estimated weekly recharge")).not.toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("skips the weekly cost query in threshold mode", () => {
    const { useWeeklyDeploymentCostQuery } = setup({ mode: "threshold" });

    expect(useWeeklyDeploymentCostQuery).toHaveBeenLastCalledWith({ enabled: false });
    expect(screen.queryByText("Estimated recharge")).not.toBeInTheDocument();
  });

  it("skips the weekly cost query while the dialog is closed", () => {
    const { useWeeklyDeploymentCostQuery } = setup({ open: false, mode: "prediction" });

    expect(useWeeklyDeploymentCostQuery).toHaveBeenLastCalledWith({ enabled: false });
  });

  it.each([
    { enableOnSave: true, title: "Auto recharge enabled" },
    { enableOnSave: false, title: "Auto recharge settings updated" }
  ])("confirms the save with '$title'", async ({ enableOnSave, title }) => {
    const enqueueSnackbar = vi.fn();
    const upsertMutate = vi.fn((_payload, options) => options?.onSuccess?.());
    setup({ enableOnSave, enqueueSnackbar, upsertMutate });

    await submit();

    expect(enqueueSnackbar.mock.lastCall![0].props.title).toBe(title);
    expect(enqueueSnackbar).toHaveBeenLastCalledWith(expect.anything(), { variant: "success", autoHideDuration: 3000 });
  });

  it("marks a Link default method with its type", () => {
    setup({ defaultPaymentMethod: mock<PaymentMethod>({ type: "link", card: undefined, link: { email: "jane@example.com" } }) });

    expect(screen.getByTestId("card-brand-mark")).toHaveTextContent("link");
    expect(screen.getByText("Link (jane@example.com)")).toBeInTheDocument();
  });

  it("blocks submit and shows an error when the amount is below the minimum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(amountInput(), { target: { value: "24.99" } });
    await submit();

    expect(screen.getByText(/Minimum amount is \$25/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("blocks submit and shows an error when the threshold is below the minimum", async () => {
    const upsertMutate = vi.fn();
    setup({ upsertMutate });

    fireEvent.change(thresholdInput(), { target: { value: "9.99" } });
    await submit();

    expect(screen.getByText(/Minimum threshold is \$10/)).toBeInTheDocument();
    expect(upsertMutate).not.toHaveBeenCalled();
  });

  it("raises stored values below the minimums to the minimums when prefilling", () => {
    setup({ threshold: 5, amount: 20 });

    expect(thresholdInput().value).toBe("10");
    expect(amountInput().value).toBe("25");
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

    expect(upsertMutate).toHaveBeenCalledWith(
      { data: { autoReloadEnabled: true, autoReloadMode: "threshold", autoReloadThreshold: 20, autoReloadAmount: 100 } },
      expect.anything()
    );
  });

  it("saves the enabled flag with values in edit mode", async () => {
    const upsertMutate = vi.fn();
    setup({ enableOnSave: false, threshold: 30, amount: 150, upsertMutate });

    await submit();

    expect(upsertMutate).toHaveBeenCalledWith(
      { data: { autoReloadEnabled: true, autoReloadMode: "threshold", autoReloadThreshold: 30, autoReloadAmount: 150 } },
      expect.anything()
    );
  });

  it("preselects threshold mode when the account has no stored mode", () => {
    setup({});

    expect(modeRadio(/fixed threshold/i)).toBeChecked();
    expect(thresholdInput()).toBeInTheDocument();
  });

  it("preselects the stored mode and hides the threshold fields in prediction mode", () => {
    setup({ mode: "prediction" });

    expect(modeRadio(/predicted spend/i)).toBeChecked();
    expect(screen.queryByLabelText(/when credit balance drops to or below/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/purchase this amount/i)).not.toBeInTheDocument();
  });

  it("tells the user the card is charged at most once per hour in threshold mode", () => {
    setup({ mode: "threshold" });

    expect(screen.getByText(/charged at most once per hour/i)).toBeInTheDocument();
  });

  it("tells the user the card is charged at most once per hour in prediction mode", () => {
    setup({ mode: "prediction" });

    expect(screen.getByText(/charged at most once per hour/i)).toBeInTheDocument();
  });

  it("saves prediction mode without threshold values", async () => {
    const upsertMutate = vi.fn();
    setup({ mode: "threshold", threshold: 30, amount: 150, upsertMutate });

    fireEvent.click(modeRadio(/predicted spend/i));
    await submit();

    expect(upsertMutate).toHaveBeenCalledWith({ data: { autoReloadEnabled: true, autoReloadMode: "prediction" } }, expect.anything());
  });

  it("saves threshold mode with values when switching back from prediction", async () => {
    const upsertMutate = vi.fn();
    setup({ mode: "prediction", threshold: 30, amount: 150, upsertMutate });

    fireEvent.click(modeRadio(/fixed threshold/i));
    await submit();

    expect(upsertMutate).toHaveBeenCalledWith(
      { data: { autoReloadEnabled: true, autoReloadMode: "threshold", autoReloadThreshold: 30, autoReloadAmount: 150 } },
      expect.anything()
    );
  });

  it("saves prediction mode even when the entered threshold is below the threshold-mode minimum", async () => {
    const upsertMutate = vi.fn();
    setup({ mode: "threshold", upsertMutate });

    fireEvent.change(thresholdInput(), { target: { value: "1" } });
    fireEvent.click(modeRadio(/predicted spend/i));
    await submit();

    expect(upsertMutate).toHaveBeenCalledWith({ data: { autoReloadEnabled: true, autoReloadMode: "prediction" } }, expect.anything());
  });

  it("resets the mode when the dialog transitions from closed to open", () => {
    const { props, rerender } = setup({ open: false, mode: "threshold" });

    rerender(<AutoRechargeSettingsPopup {...props} open mode="prediction" />);

    expect(modeRadio(/predicted spend/i)).toBeChecked();
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

    rerender(<AutoRechargeSettingsPopup {...props} open threshold={40} amount={300} />);

    expect(thresholdInput().value).toBe("40");
    expect(amountInput().value).toBe("300");
  });

  it("keeps in-progress edits when the stored values change while the dialog stays open", () => {
    const { props, rerender } = setup({ open: true, threshold: 20, amount: 100 });

    fireEvent.change(amountInput(), { target: { value: "150" } });
    rerender(<AutoRechargeSettingsPopup {...props} amount={120} />);

    expect(amountInput().value).toBe("150");
  });

  it("recommends the fixed threshold mode in the enable flow", () => {
    setup({ enableOnSave: true });

    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(modeRadio(/fixed threshold/i)).toHaveAccessibleName(/recommended/i);
    expect(modeRadio(/predicted spend/i)).not.toHaveAccessibleName(/recommended/i);
  });

  it("does not recommend a mode when editing existing settings", () => {
    setup({ enableOnSave: false });

    expect(screen.queryByText("Recommended")).not.toBeInTheDocument();
  });

  function modeRadio(name: RegExp) {
    return screen.getByRole("radio", { name });
  }

  function thresholdInput() {
    return screen.getByLabelText(/when credit balance drops to or below/i) as HTMLInputElement;
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
    mode?: "prediction" | "threshold";
    threshold?: number;
    amount?: number;
    onClose?: () => void;
    enqueueSnackbar?: Mock;
    upsertMutate?: ReturnType<typeof vi.fn>;
    isPending?: boolean;
    weeklyCost?: number;
    isWeeklyCostLoading?: boolean;
    defaultPaymentMethod?: PaymentMethod;
  }) {
    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () =>
      mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar: input.enqueueSnackbar ?? vi.fn() });

    const paymentMethod =
      input.defaultPaymentMethod ??
      mock<PaymentMethod>({
        card: { brand: "visa", last4: "5720", exp_month: 5, exp_year: 30 } as PaymentMethod["card"]
      });
    const useDefaultPaymentMethodQuery: typeof DEPENDENCIES.useDefaultPaymentMethodQuery = () =>
      mock<ReturnType<typeof DEPENDENCIES.useDefaultPaymentMethodQuery>>({ data: paymentMethod });

    const useWalletSettingsMutations: typeof DEPENDENCIES.useWalletSettingsMutations = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWalletSettingsMutations>>({
        upsertWalletSettings: Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWalletSettingsMutations>["upsertWalletSettings"]>(), {
          mutate: input.upsertMutate ?? vi.fn(),
          isPending: input.isPending ?? false
        })
      });

    const useWeeklyDeploymentCostQuery = vi.fn(() =>
      mock<ReturnType<typeof DEPENDENCIES.useWeeklyDeploymentCostQuery>>({ data: input.isWeeklyCostLoading ? undefined : input.weeklyCost ?? 42 })
    );

    const dependencies = {
      useForm,
      useSnackbar,
      useDefaultPaymentMethodQuery,
      useWalletSettingsMutations,
      useWeeklyDeploymentCostQuery,
      CardBrandMark: ({ brand }: { brand?: string | null }) => <span data-testid="card-brand-mark">{brand}</span>,
      UsdValue: ({ value }: { value: number }) => <>{value}</>,
      Skeleton: () => <span data-testid="skeleton" />
    };

    const props = {
      open: input.open ?? true,
      onClose: input.onClose ?? vi.fn(),
      enableOnSave: input.enableOnSave ?? false,
      mode: input.mode,
      threshold: input.threshold,
      amount: input.amount,
      dependencies
    };

    const utils = render(<AutoRechargeSettingsPopup {...props} />);

    return { ...utils, props, useWeeklyDeploymentCostQuery };
  }
});
