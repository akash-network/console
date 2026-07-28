import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES } from "./AccountOverview";
import { AccountOverview } from "./AccountOverview";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AccountOverview.name, () => {
  it("opens the add credits sheet when openPayment query param is true", () => {
    const mockReplace = vi.fn();
    const { dependencies } = setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
    expect(dependencies.AddCreditsSheet).toHaveBeenCalledWith(expect.objectContaining({ open: true, initialTab: "purchase" }), expect.anything());
  });

  it("does not open the add credits sheet when openPayment query param is absent", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: () => null,
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("add-credits-sheet")).not.toBeInTheDocument();
  });

  it("opens the add credits sheet when openPayment query param is true even without default payment method", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: undefined,
      isLoading: false
    });

    expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
  });

  it("does not open the add credits sheet while still loading", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: true
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens the add credits sheet from the Add Funds button even without a default payment method", () => {
    setup({
      searchParamsGet: () => null,
      defaultPaymentMethod: undefined,
      isLoading: false
    });

    const addFundsButton = screen.getByRole("button", { name: /add funds/i });
    expect(addFundsButton).toBeEnabled();

    fireEvent.click(addFundsButton);

    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
  });

  it("shows the payment success animation and closes the sheet when a purchase completes", () => {
    const { dependencies, MockAddCreditsSheet } = setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    act(() => MockAddCreditsSheet.mock.calls.at(-1)![0].onDone(100));

    expect(dependencies.PaymentSuccessAnimation).toHaveBeenCalledWith(expect.objectContaining({ show: true, amount: "100" }), expect.anything());
    expect(MockAddCreditsSheet).toHaveBeenCalledWith(expect.objectContaining({ open: false }), expect.anything());
  });

  it("forwards the granted first-purchase bonus to the payment success animation", () => {
    const { dependencies, MockAddCreditsSheet } = setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    act(() => MockAddCreditsSheet.mock.calls.at(-1)![0].onDone(100, undefined, 10));

    expect(dependencies.PaymentSuccessAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ show: true, amount: "100", bonusAmount: "10" }),
      expect.anything()
    );
  });

  describe("when the fixed-threshold flag is enabled", () => {
    it("renders the Auto Top-Up title", () => {
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: { id: "pm_123" }, isLoading: false });

      expect(screen.getByText("Auto Top-Up")).toBeInTheDocument();
    });

    it("shows the threshold summary with stored values when enabled", () => {
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      expect(screen.getByText(/Top up/)).toHaveTextContent("Top up 100 when balance ≤ 20");
      expect(screen.queryByText(/per week/)).not.toBeInTheDocument();
    });

    it("shows 'Add funds automatically' when disabled with a payment method", () => {
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
        walletSettings: { autoReloadEnabled: false }
      });

      expect(screen.getByText("Add funds automatically")).toBeInTheDocument();
    });

    it("opens the settings dialog in enable mode without mutating when the switch is turned on", () => {
      const { dependencies, upsertMutate } = setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
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
        isLoading: false,
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
        isLoading: false,
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenCalledWith(expect.objectContaining({ open: true, enableOnSave: false }), expect.anything());
    });

    it("disables the switch and edit button without a payment method", () => {
      setup({ isFixedThresholdEnabled: true, defaultPaymentMethod: undefined, isLoading: false });

      expect(screen.getByRole("switch")).toBeDisabled();
      expect(screen.getByRole("button", { name: /edit auto top-up settings/i })).toBeDisabled();
      expect(screen.getByText(/Add a payment method/)).toBeInTheDocument();
    });

    it("does not disable auto top-up when the confirmation is cancelled", async () => {
      const upsertMutate = vi.fn();
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 },
        confirmResult: false,
        upsertMutate
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("switch"));
      });

      expect(upsertMutate).not.toHaveBeenCalled();
    });

    it("shows a success snackbar when disabling auto top-up succeeds", async () => {
      const enqueueSnackbar = vi.fn();
      const upsertMutate = vi.fn((_payload, options) => options?.onSuccess?.({ data: { autoReloadEnabled: false } }));
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
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

    it("shows an error snackbar when disabling auto top-up fails", async () => {
      const enqueueSnackbar = vi.fn();
      const upsertMutate = vi.fn((_payload, options) => options?.onError?.(new Error("failed")));
      setup({
        isFixedThresholdEnabled: true,
        defaultPaymentMethod: { id: "pm_123" },
        isLoading: false,
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
        isLoading: false,
        walletSettings: { autoReloadEnabled: true, autoReloadThreshold: 20, autoReloadAmount: 100 }
      });

      fireEvent.click(screen.getByRole("button", { name: /edit auto top-up settings/i }));
      const openedProps = vi.mocked(dependencies.AutoTopUpSettingsPopup).mock.calls.at(-1)![0];
      expect(openedProps.open).toBe(true);

      act(() => openedProps.onClose());

      expect(dependencies.AutoTopUpSettingsPopup).toHaveBeenLastCalledWith(expect.objectContaining({ open: false }), expect.anything());
    });
  });

  function setup(input: {
    searchParamsGet?: (key: string) => string | null;
    routerReplace?: ReturnType<typeof vi.fn>;
    defaultPaymentMethod?: { id: string };
    isLoading?: boolean;
    isFixedThresholdEnabled?: boolean;
    walletSettings?: { autoReloadEnabled: boolean; autoReloadThreshold?: number; autoReloadAmount?: number };
    confirmResult?: boolean;
    upsertMutate?: ReturnType<typeof vi.fn>;
    enqueueSnackbar?: ReturnType<typeof vi.fn>;
  }) {
    const mockReplace = input.routerReplace ?? vi.fn();
    const mockSearchParams = { get: vi.fn(input.searchParamsGet ?? (() => null)) };
    const mockRouter = { replace: mockReplace, push: vi.fn() };
    const upsertMutate = input.upsertMutate ?? vi.fn();
    const enqueueSnackbar = input.enqueueSnackbar ?? vi.fn();

    const MockAddCreditsSheet = vi.fn((props: Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0]) =>
      props.open ? <div data-testid="add-credits-sheet" /> : null
    );

    const MockButton = vi.fn(({ children, ...props }: Parameters<typeof DEPENDENCIES.Button>[0]) => <button {...props}>{children}</button>);

    const MockSwitch = vi.fn(({ checked, onCheckedChange, disabled }: Parameters<typeof DEPENDENCIES.Switch>[0]) => (
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onCheckedChange?.(e.target.checked)} />
    ));

    const MockFormattedNumber = vi.fn(({ value }: Parameters<typeof DEPENDENCIES.FormattedNumber>[0]) => <>{value}</>);

    const dependencies = {
      ...MockComponents(DEPENDENCIES),
      useFlag: vi.fn(() => input.isFixedThresholdEnabled ?? false),
      useSnackbar: vi.fn(() => ({ enqueueSnackbar })),
      useDefaultPaymentMethodQuery: vi.fn(() => ({
        data: input.defaultPaymentMethod,
        isLoading: input.isLoading ?? false
      })),
      useWalletBalance: vi.fn(() => ({
        balance: { totalDeploymentGrantsUSD: 100, totalDeploymentEscrowUSD: 10 },
        isLoading: false
      })),
      useWalletSettingsQuery: vi.fn(() => ({ data: input.walletSettings ?? { autoReloadEnabled: false } })),
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: 5 })),
      useWalletSettingsMutations: vi.fn(() => ({
        upsertWalletSettings: { mutate: upsertMutate, isPending: false }
      })),
      usePopup: vi.fn(() => ({ confirm: vi.fn().mockResolvedValue(input.confirmResult ?? true) })),
      useSearchParams: vi.fn(() => mockSearchParams),
      useRouter: vi.fn(() => mockRouter),
      useServices: vi.fn(() => ({
        urlService: {
          billing: () => "/billing",
          paymentMethods: () => "/payment-methods"
        }
      })),
      Button: MockButton,
      Switch: MockSwitch,
      FormattedNumber: MockFormattedNumber,
      AddCreditsSheet: MockAddCreditsSheet
    } as unknown as typeof DEPENDENCIES;

    render(<AccountOverview dependencies={dependencies} />);

    return { dependencies, MockAddCreditsSheet, upsertMutate };
  }
});
