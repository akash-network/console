import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES } from "./AccountOverview";
import { AccountOverview } from "./AccountOverview";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AccountOverview.name, () => {
  it("opens payment popup when openPayment query param is true and payment method exists", () => {
    const mockReplace = vi.fn();
    const { dependencies } = setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    expect(screen.queryByTestId("payment-popup")).toBeInTheDocument();
    expect(dependencies.PaymentPopup).toHaveBeenCalledWith(expect.objectContaining({ open: true, selectedPaymentMethodId: "pm_123" }), expect.anything());
  });

  it("does not open payment popup when openPayment query param is absent", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: () => null,
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: false
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("payment-popup")).not.toBeInTheDocument();
  });

  it("opens payment popup when openPayment query param is true even without default payment method", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: undefined,
      isLoading: false
    });

    expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    expect(screen.queryByTestId("payment-popup")).toBeInTheDocument();
  });

  it("does not open payment popup while still loading", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: { id: "pm_123" },
      isLoading: true
    });

    expect(mockReplace).not.toHaveBeenCalled();
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

    const MockPaymentPopup = vi.fn((props: { open: boolean }) => (props.open ? <div data-testid="payment-popup" /> : null));

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
      PaymentPopup: MockPaymentPopup
    } as unknown as typeof DEPENDENCIES;

    render(<AccountOverview dependencies={dependencies} />);

    return { dependencies };
  }
});
