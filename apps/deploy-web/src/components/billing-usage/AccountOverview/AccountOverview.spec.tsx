import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./AccountOverview";
import { AccountOverview } from "./AccountOverview";

import { render, screen } from "@testing-library/react";

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
    expect(screen.getByTestId("payment-popup")).toBeInTheDocument();
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

  it("does not open payment popup when no default payment method", () => {
    const mockReplace = vi.fn();
    setup({
      searchParamsGet: (key: string) => (key === "openPayment" ? "true" : null),
      routerReplace: mockReplace,
      defaultPaymentMethod: undefined,
      isLoading: false
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("payment-popup")).not.toBeInTheDocument();
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
    const MockPaymentSuccessAnimation = vi.fn(() => null);
    const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    const MockFormattedNumber = ({ value }: { value: number }) => <span>{value}</span>;

    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: vi.fn(() => ({ enqueueSnackbar: vi.fn() })) as any,
      useDefaultPaymentMethodQuery: vi.fn(() => ({
        data: input.defaultPaymentMethod,
        isLoading: input.isLoading ?? false
      })) as any,
      useWalletBalance: vi.fn(() => ({
        balance: { totalDeploymentGrantsUSD: 100, totalDeploymentEscrowUSD: 10 },
        isLoading: false
      })) as any,
      useWalletSettingsQuery: vi.fn(() => ({ data: { autoReloadEnabled: false } })) as any,
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: 5 })) as any,
      useWalletSettingsMutations: vi.fn(() => ({
        upsertWalletSettings: { mutate: vi.fn(), isPending: false }
      })) as any,
      usePopup: vi.fn(() => ({ confirm: vi.fn() })) as any,
      useSearchParams: vi.fn(() => mockSearchParams) as any,
      useRouter: vi.fn(() => mockRouter) as any,
      PaymentPopup: MockPaymentPopup as any,
      PaymentSuccessAnimation: MockPaymentSuccessAnimation as any,
      Title: Stub as any,
      FormattedNumber: MockFormattedNumber as any,
      Link: Stub as any,
      Button: Stub as any,
      Card: Stub as any,
      CardContent: Stub as any,
      CardHeader: Stub as any,
      CustomTooltip: Stub as any,
      Skeleton: Stub as any,
      Snackbar: Stub as any,
      Switch: Stub as any,
      LinearProgress: Stub as any,
      UrlService: {
        billing: () => "/billing",
        paymentMethods: () => "/payment-methods"
      } as any
    };

    render(<AccountOverview dependencies={dependencies} />);

    return { dependencies };
  }
});
