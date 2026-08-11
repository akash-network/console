import { describe, expect, it, vi } from "vitest";

import { AutoTopUpSection, DEPENDENCIES } from "./AutoTopUpSection";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AutoTopUpSection.name, () => {
  it("shows the weekly recharge estimate when the fixed-threshold flag is off", () => {
    setup({ isFixedThresholdEnabled: false, defaultPaymentMethod: { id: "pm_123" }, weeklyCost: 42 });

    expect(screen.getByText("Auto Recharge")).toBeInTheDocument();
    expect(screen.getByText(/per week/)).toHaveTextContent("42");
  });

  describe("when the fixed-threshold flag is enabled", () => {
    it("renders the Auto Top-Up title", () => {
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: { id: "pm_123" } });

      expect(screen.getByText("Auto Top-Up")).toBeInTheDocument();
    });

    it("shows the threshold and top-up amounts when enabled", () => {
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      expect(screen.getByText("Threshold")).toBeInTheDocument();
      expect(screen.getByText("Top up")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("prompts to turn on auto top-up when disabled with a payment method", () => {
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: { id: "pm_123" }, walletSettings: { autoReloadEnabled: false } });

      expect(screen.getByText(/Turn on Auto Top-Up to add funds automatically/)).toBeInTheDocument();
    });

    it("opens the settings dialog in enable mode without mutating when the switch is turned on", () => {
      const { dependencies, upsertMutate } = setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: false }
      });

      fireEvent.click(screen.getByRole("switch"));

      expect(upsertMutate).not.toHaveBeenCalled();
      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
    });

    it("confirms then disables auto top-up when the switch is turned off", async () => {
      const upsertMutate = vi.fn();
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        confirmResult: true,
        upsertMutate
      });

      fireEvent.click(screen.getByRole("switch"));

      await vi.waitFor(() => {
        expect(upsertMutate).toHaveBeenCalledWith(expect.objectContaining({ data: { autoReloadEnabled: false } }), expect.anything());
      });
    });

    it("opens the settings dialog in edit mode from the edit button", () => {
      const { dependencies } = setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenCalledWith(expect.objectContaining({ open: true, enableOnSave: false }), expect.anything());
    });

    it("disables the switch and hides the edit button without a payment method", () => {
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: undefined });

      expect(screen.getByRole("switch")).toBeDisabled();
      expect(screen.queryByRole("button", { name: /edit auto top-up settings/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Add a payment method/)).toBeInTheDocument();
    });

    it("opens the add-payment-method flow from the prompt when there is no payment method", () => {
      const openAddPaymentMethod = vi.fn();
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: undefined, openAddPaymentMethod });

      fireEvent.click(screen.getByText("Add a payment method"));

      expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it("disables the edit button while a settings update is in flight", () => {
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        isPending: true
      });

      expect(screen.getByRole("button", { name: /edit auto top-up settings/i })).toBeDisabled();
    });

    it("does not disable auto top-up when the confirmation is cancelled", async () => {
      const upsertMutate = vi.fn();
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        confirmResult: false,
        upsertMutate
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("switch"));
      });

      expect(upsertMutate).not.toHaveBeenCalled();
    });

    it("shows a snackbar when disabling auto top-up succeeds", async () => {
      const enqueueSnackbar = vi.fn();
      const upsertMutate = vi.fn((_payload, options) => options?.onSuccess?.({ data: { autoReloadEnabled: false } }));
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        confirmResult: true,
        upsertMutate,
        enqueueSnackbar
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("switch"));
      });

      expect(enqueueSnackbar).toHaveBeenCalled();
    });

    it("closes the settings dialog when the popup requests it", () => {
      const { dependencies } = setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));
      const openedProps = vi.mocked(dependencies.AutoTopUpSettingsPopup).mock.calls.at(-1)![0];

      act(() => openedProps.onClose());

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
    });
  });

  function setup(input: {
    isFixedThresholdEnabled?: boolean;
    defaultPaymentMethod?: { id: string };
    walletSettings?: { autoReloadEnabled: boolean; autoReloadThreshold?: number; autoReloadAmount?: number };
    weeklyCost?: number;
    confirmResult?: boolean;
    upsertMutate?: ReturnType<typeof vi.fn>;
    enqueueSnackbar?: ReturnType<typeof vi.fn>;
    isPending?: boolean;
    perHour?: number;
    available?: number;
    openAddPaymentMethod?: ReturnType<typeof vi.fn>;
  }) {
    const upsertMutate = input.upsertMutate ?? vi.fn();
    const enqueueSnackbar = input.enqueueSnackbar ?? vi.fn();
    const openAddPaymentMethod = input.openAddPaymentMethod ?? vi.fn();

    const MockButton = vi.fn(({ children, ...props }: Parameters<typeof DEPENDENCIES.Button>[0]) => <button {...props}>{children}</button>);
    const MockSwitch = vi.fn(({ checked, onCheckedChange, disabled }: Parameters<typeof DEPENDENCIES.Switch>[0]) => (
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onCheckedChange?.(e.target.checked)} />
    ));
    const MockFormattedNumber = vi.fn(({ value }: Parameters<typeof DEPENDENCIES.FormattedNumber>[0]) => <>{value}</>);

    const dependencies = {
      ...MockComponents(DEPENDENCIES),
      useFlag: vi.fn(() => input.isFixedThresholdEnabled ?? false),
      useSnackbar: vi.fn(() => ({ enqueueSnackbar })),
      useDefaultPaymentMethodQuery: vi.fn(() => ({ data: input.defaultPaymentMethod, isLoading: false })),
      useWalletSettingsQuery: vi.fn(() => ({ data: input.walletSettings ?? { autoReloadEnabled: false }, isLoading: false })),
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: input.weeklyCost ?? 5 })),
      useWalletSettingsMutations: vi.fn(() => ({ upsertWalletSettings: { mutate: upsertMutate, isPending: input.isPending ?? false } })),
      useAccountBalanceOverview: vi.fn(() => ({ perHour: input.perHour ?? 0, available: input.available ?? 0 })),
      useBillingActions: vi.fn(() => ({ openAddPaymentMethod })),
      usePopup: vi.fn(() => ({ confirm: vi.fn().mockResolvedValue(input.confirmResult ?? true) })),
      Button: MockButton,
      Switch: MockSwitch,
      FormattedNumber: MockFormattedNumber
    } as unknown as typeof DEPENDENCIES;

    render(<AutoTopUpSection dependencies={dependencies} />);

    return { dependencies, upsertMutate, enqueueSnackbar, openAddPaymentMethod };
  }
});
