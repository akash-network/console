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

  function setup(input: {
    searchParamsGet?: (key: string) => string | null;
    routerReplace?: ReturnType<typeof vi.fn>;
    defaultPaymentMethod?: { id: string };
    isLoading?: boolean;
  }) {
    const mockReplace = input.routerReplace ?? vi.fn();
    const mockSearchParams = { get: vi.fn(input.searchParamsGet ?? (() => null)) };
    const mockRouter = { replace: mockReplace, push: vi.fn() };

    const MockAddCreditsSheet = vi.fn((props: Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0]) =>
      props.open ? <div data-testid="add-credits-sheet" /> : null
    );

    const MockButton = vi.fn(({ children, ...props }: Parameters<typeof DEPENDENCIES.Button>[0]) => <button {...props}>{children}</button>);

    const dependencies = {
      ...MockComponents(DEPENDENCIES),
      useSnackbar: vi.fn(() => ({ enqueueSnackbar: vi.fn() })),
      useDefaultPaymentMethodQuery: vi.fn(() => ({
        data: input.defaultPaymentMethod,
        isLoading: input.isLoading ?? false
      })),
      useWalletBalance: vi.fn(() => ({
        balance: { totalDeploymentGrantsUSD: 100, totalDeploymentEscrowUSD: 10 },
        isLoading: false
      })),
      useWalletSettingsQuery: vi.fn(() => ({ data: { autoReloadEnabled: false } })),
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: 5 })),
      useWalletSettingsMutations: vi.fn(() => ({
        upsertWalletSettings: { mutate: vi.fn(), isPending: false }
      })),
      usePopup: vi.fn(() => ({ confirm: vi.fn() })),
      useSearchParams: vi.fn(() => mockSearchParams),
      useRouter: vi.fn(() => mockRouter),
      useServices: vi.fn(() => ({
        urlService: {
          billing: () => "/billing",
          paymentMethods: () => "/payment-methods"
        }
      })),
      Button: MockButton,
      AddCreditsSheet: MockAddCreditsSheet
    } as unknown as typeof DEPENDENCIES;

    render(<AccountOverview dependencies={dependencies} />);

    return { dependencies, MockAddCreditsSheet };
  }
});
