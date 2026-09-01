import { describe, expect, it, vi } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import { AutoTopUpSection, DEPENDENCIES } from "./AutoTopUpSection";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AutoTopUpSection.name, () => {
  it("shows the weekly recharge estimate when threshold mode is not offered", () => {
    setup({ isThresholdModeOffered: false, defaultPaymentMethod: { id: "pm_123" }, weeklyCost: 42 });

    expect(screen.getByText("Auto Recharge")).toBeInTheDocument();
    expect(screen.getByText(/per week/)).toHaveTextContent("42");
  });

  it("shows a skeleton instead of a zero recharge estimate while the weekly cost is still loading", () => {
    setup({ isThresholdModeOffered: false, defaultPaymentMethod: { id: "pm_123" }, isWeeklyCostLoading: true });

    expect(screen.getByText(/per week/)).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("runs the weekly cost query without waiting for wallet settings when threshold mode is not offered", () => {
    const { dependencies } = setup({ isThresholdModeOffered: false, defaultPaymentMethod: { id: "pm_123" }, isWalletSettingsLoading: true });

    expect(dependencies.useWeeklyDeploymentCostQuery).toHaveBeenCalledWith({ enabled: true });
  });

  describe("when threshold mode is offered", () => {
    it("renders the Auto Top-Up title", () => {
      setup({ isThresholdModeOffered: true, defaultPaymentMethod: { id: "pm_123" } });

      expect(screen.getByText("Auto Top-Up")).toBeInTheDocument();
    });

    it("shows the threshold and top-up amounts when enabled", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      expect(screen.getByText("Threshold")).toBeInTheDocument();
      expect(screen.getByText("Top up")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });

    it("shows the predicted weekly spend when the stored mode is prediction", () => {
      setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction" },
        weeklyCost: 42
      });

      expect(screen.getByText("Auto Top-Up")).toBeInTheDocument();
      expect(screen.getByText("Predicted spend")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
      expect(screen.queryByText("Threshold")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /edit auto top-up settings/i })).toBeInTheDocument();
    });

    it("passes the stored mode to the settings dialog", () => {
      const { dependencies } = setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction" }
      });

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenCalledWith(expect.objectContaining({ mode: "prediction" }), expect.anything());
    });

    it("skips the weekly cost query in threshold mode and runs it in prediction mode", () => {
      const { dependencies: thresholdDependencies } = setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "threshold" }
      });

      expect(thresholdDependencies.useWeeklyDeploymentCostQuery).toHaveBeenCalledWith({ enabled: false });

      const { dependencies: predictionDependencies } = setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction" }
      });

      expect(predictionDependencies.useWeeklyDeploymentCostQuery).toHaveBeenCalledWith({ enabled: true });
    });

    it("prompts to turn on auto top-up when disabled with a payment method", () => {
      setup({ isThresholdModeOffered: true, defaultPaymentMethod: { id: "pm_123" }, walletSettings: { autoReloadEnabled: false } });

      expect(screen.getByText(/Turn on Auto Top-Up to add funds automatically/)).toBeInTheDocument();
    });

    it("prompts without naming a rule when disabled in prediction mode", () => {
      setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: false, autoReloadMode: "prediction" }
      });

      expect(screen.getByText(/You pick the rule when you set it up/)).toBeInTheDocument();
      expect(screen.queryByText(/cover the week ahead/)).not.toBeInTheDocument();
    });

    it("holds back the mode description until a rule is actually running", () => {
      setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: false, autoReloadMode: "prediction" }
      });

      expect(screen.getByText("Automatically adds credits to keep your deployments running.")).toBeInTheDocument();
      expect(screen.queryByText(/Tops up to cover the week ahead/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Tops up when your/)).not.toBeInTheDocument();
    });

    it("describes the stored rule once auto top-up is enabled", () => {
      setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction" }
      });

      expect(screen.getByText("Tops up to cover the week ahead for your running deployments.")).toBeInTheDocument();
      expect(screen.queryByText("Automatically adds credits to keep your deployments running.")).not.toBeInTheDocument();
    });

    it("shows a skeleton instead of a zero predicted spend while the weekly cost is still loading", () => {
      setup({
        isThresholdModeOffered: true,
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction" },
        isWeeklyCostLoading: true
      });

      expect(screen.getByText("Predicted spend")).toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    describe("while wallet settings are still loading", () => {
      it("disables the switch so the settings dialog cannot be seeded from unresolved settings", () => {
        setup({ isThresholdModeOffered: true, defaultPaymentMethod: { id: "pm_123" }, isWalletSettingsLoading: true });

        expect(screen.getByRole("switch")).toBeDisabled();
      });

      it("holds back the mode description instead of committing to the fallback mode", () => {
        setup({ isThresholdModeOffered: true, defaultPaymentMethod: { id: "pm_123" }, isWalletSettingsLoading: true });

        expect(screen.queryByText(/Tops up when your/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Tops up to cover the week ahead/)).not.toBeInTheDocument();
      });
    });

    it("opens the settings dialog in enable mode without mutating when the switch is turned on", () => {
      const { dependencies, upsertMutate } = setup({
        isThresholdModeOffered: true,
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
        isThresholdModeOffered: true,
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
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenCalledWith(expect.objectContaining({ open: true, enableOnSave: false }), expect.anything());
    });

    it("shows the next top-up estimate even when the default payment method is not a card", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 50 },
        perHour: 1,
        available: 100
      });

      expect(screen.getByText(/Charges your default payment method/)).toBeInTheDocument();
      expect(screen.getByText(/Next top-up in about/)).toBeInTheDocument();
    });

    it("names the default card in the charge summary", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123", card: { brand: "visa", last4: "4242" } },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 50 }
      });

      expect(screen.getByText(/Charges Visa \*\*\*\* 4242/)).toBeInTheDocument();
    });

    it("disables the switch and hides the edit button without a payment method", () => {
      setup({ isThresholdModeOffered: true, defaultPaymentMethod: undefined });

      expect(screen.getByRole("switch")).toBeDisabled();
      expect(screen.queryByRole("button", { name: /edit auto top-up settings/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Add a payment method/)).toBeInTheDocument();
    });

    it("shows a skeleton instead of the add-payment-method prompt while the payment method query is loading", () => {
      setup({ isThresholdModeOffered: true, defaultPaymentMethod: undefined, isDefaultPaymentMethodLoading: true });

      expect(screen.queryByText(/Add a payment method/)).not.toBeInTheDocument();
    });

    it("opens the add-payment-method flow from the prompt when there is no payment method", () => {
      const openAddPaymentMethod = vi.fn();
      setup({ isThresholdModeOffered: true, defaultPaymentMethod: undefined, openAddPaymentMethod });

      fireEvent.click(screen.getByText("Add a payment method"));

      expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it("disables the edit button while a settings update is in flight", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        isPending: true
      });

      expect(screen.getByRole("button", { name: /edit auto top-up settings/i })).toBeDisabled();
    });

    it("does not disable auto top-up when the confirmation is cancelled", async () => {
      const upsertMutate = vi.fn();
      setup({
        isThresholdModeOffered: true,
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
        isThresholdModeOffered: true,
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

    describe("when arriving from the deploy flow's setup link", () => {
      it("opens the add-payment-method flow and clears the param when no card is on file", () => {
        const { openAddPaymentMethod, replace, dependencies } = setup({
          isThresholdModeOffered: true,
          defaultPaymentMethod: undefined,
          hasSetupAutoTopUpParam: true
        });

        expect(openAddPaymentMethod).toHaveBeenCalledTimes(1);
        expect(openAddPaymentMethod).toHaveBeenCalledWith(expect.objectContaining({ onSuccess: expect.any(Function) }));
        expect(replace).toHaveBeenCalledWith("/billing", { scroll: false });
        expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
      });

      it("opens the settings dialog straight away when a card is already on file", () => {
        const { openAddPaymentMethod, dependencies } = setup({
          isThresholdModeOffered: true,
          defaultPaymentMethod: { id: "pm_123" },
          hasSetupAutoTopUpParam: true
        });

        expect(openAddPaymentMethod).not.toHaveBeenCalled();
        expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
      });

      it("opens the settings dialog through the callback it hands the card flow", () => {
        const openAddPaymentMethod = vi.fn();
        const { dependencies } = setup({
          isThresholdModeOffered: true,
          defaultPaymentMethod: undefined,
          hasSetupAutoTopUpParam: true,
          openAddPaymentMethod
        });

        act(() => openAddPaymentMethod.mock.calls[0][0].onSuccess());

        expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: true, enableOnSave: true }), expect.anything());
      });

      it("leaves the settings dialog closed without the param", () => {
        const { openAddPaymentMethod, replace, dependencies } = setup({ isThresholdModeOffered: true, defaultPaymentMethod: { id: "pm_123" } });

        expect(openAddPaymentMethod).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
        expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
      });

      it("waits for the payment method query before acting on the param", () => {
        const { openAddPaymentMethod, replace } = setup({
          isThresholdModeOffered: true,
          defaultPaymentMethod: undefined,
          isDefaultPaymentMethodLoading: true,
          hasSetupAutoTopUpParam: true
        });

        expect(openAddPaymentMethod).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
      });
    });

    it("closes the settings dialog when the popup requests it", () => {
      const { dependencies } = setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));
      const openedProps = vi.mocked(dependencies.AutoTopUpSettingsPopup).mock.calls.at(-1)![0];

      act(() => openedProps.onClose());

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
    });
  });

  describe("when auto top-up is paused after repeated card declines", () => {
    it("says the card was declined instead of showing the top-up rule", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123", card: { brand: "visa", last4: "4242" } },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100, autoReloadPausedAt: "2026-09-01T12:00:00.000Z" }
      });

      expect(screen.getByText(/Paused\./)).toBeInTheDocument();
      expect(screen.getByText(/was declined several times/)).toBeInTheDocument();
      expect(screen.queryByText("Threshold")).not.toBeInTheDocument();
    });

    it("warns prediction-mode wallets too", () => {
      setup({
        autoReloadMode: "prediction",
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadMode: "prediction", autoReloadPausedAt: "2026-09-01T12:00:00.000Z" }
      });

      expect(screen.getByText(/Paused\./)).toBeInTheDocument();
      expect(screen.queryByText(/Recharge amount is approximately/)).not.toBeInTheDocument();
    });

    it("sends the user to their payment methods to lift the pause", () => {
      const openAddPaymentMethod = vi.fn();
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadPausedAt: "2026-09-01T12:00:00.000Z" },
        openAddPaymentMethod
      });

      fireEvent.click(screen.getByText("Update your payment method"));

      expect(openAddPaymentMethod).toHaveBeenCalled();
    });

    it("shows the top-up rule again once the pause is lifted", () => {
      setup({
        isThresholdModeOffered: true,
        defaultPaymentMethod: { id: "pm_123" },
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100, autoReloadPausedAt: null }
      });

      expect(screen.queryByText(/Paused\./)).not.toBeInTheDocument();
      expect(screen.getByText("Threshold")).toBeInTheDocument();
    });
  });

  function setup(input: {
    isThresholdModeOffered?: boolean;
    autoReloadMode?: "prediction" | "threshold";
    defaultPaymentMethod?: { id: string; card?: { brand?: string; last4?: string } };
    isDefaultPaymentMethodLoading?: boolean;
    walletSettings?: {
      autoReloadEnabled: boolean;
      autoReloadMode?: "prediction" | "threshold";
      autoReloadThreshold?: number;
      autoReloadAmount?: number;
      autoReloadPausedAt?: string | null;
    };
    isWalletSettingsLoading?: boolean;
    weeklyCost?: number;
    isWeeklyCostLoading?: boolean;
    confirmResult?: boolean;
    upsertMutate?: ReturnType<typeof vi.fn>;
    enqueueSnackbar?: ReturnType<typeof vi.fn>;
    isPending?: boolean;
    perHour?: number;
    available?: number;
    openAddPaymentMethod?: ReturnType<typeof vi.fn>;
    hasSetupAutoTopUpParam?: boolean;
  }) {
    const upsertMutate = input.upsertMutate ?? vi.fn();
    const enqueueSnackbar = input.enqueueSnackbar ?? vi.fn();
    const openAddPaymentMethod = input.openAddPaymentMethod ?? vi.fn();
    const replace = vi.fn();

    const MockButton = vi.fn(({ children, ...props }: Parameters<typeof DEPENDENCIES.Button>[0]) => <button {...props}>{children}</button>);
    const MockSwitch = vi.fn(({ checked, onCheckedChange, disabled }: Parameters<typeof DEPENDENCIES.Switch>[0]) => (
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onCheckedChange?.(e.target.checked)} />
    ));
    const MockUsdValue = vi.fn(({ value }: Parameters<typeof DEPENDENCIES.UsdValue>[0]) => <>{value}</>);

    const dependencies = {
      ...MockComponents(DEPENDENCIES),
      useAutoReloadMode: vi.fn(() => {
        const mode = input.autoReloadMode ?? (input.isThresholdModeOffered ? "threshold" : "prediction");
        return {
          mode,
          isThresholdModeOffered: input.isThresholdModeOffered ?? false,
          showsThresholdRule: !!input.isThresholdModeOffered && mode === "threshold",
          isLoading: false
        };
      }),
      useSnackbar: vi.fn(() => ({ enqueueSnackbar })),
      useDefaultPaymentMethodQuery: vi.fn(() => ({ data: input.defaultPaymentMethod, isLoading: input.isDefaultPaymentMethodLoading ?? false })),
      useWalletSettingsQuery: vi.fn(() => ({
        data: input.isWalletSettingsLoading ? undefined : input.walletSettings ?? { autoReloadEnabled: false },
        isLoading: input.isWalletSettingsLoading ?? false
      })),
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: input.isWeeklyCostLoading ? undefined : input.weeklyCost ?? 5 })),
      useWalletSettingsMutations: vi.fn(() => ({ upsertWalletSettings: { mutate: upsertMutate, isPending: input.isPending ?? false } })),
      useAccountBalanceOverview: vi.fn(() => ({ perHour: input.perHour ?? 0, available: input.available ?? 0 })),
      useBillingActions: vi.fn(() => ({ openAddPaymentMethod })),
      useSearchParams: vi.fn(() => ({ get: (key: string) => (key === "setupAutoTopUp" && input.hasSetupAutoTopUpParam ? "true" : null) })),
      useRouter: vi.fn(() => ({ replace })),
      useServices: vi.fn(() => ({ urlService: UrlService })),
      usePopup: vi.fn(() => ({ confirm: vi.fn().mockResolvedValue(input.confirmResult ?? true) })),
      Button: MockButton,
      Switch: MockSwitch,
      UsdValue: MockUsdValue
    } as unknown as typeof DEPENDENCIES;

    render(<AutoTopUpSection dependencies={dependencies} />);

    return { dependencies, upsertMutate, enqueueSnackbar, openAddPaymentMethod, replace };
  }
});
