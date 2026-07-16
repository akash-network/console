import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES } from "./AccountOverview";
import { AccountOverview } from "./AccountOverview";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

type OpenFn = ReturnType<typeof DEPENDENCIES.useBillingSheet>["open"];

describe(AccountOverview.name, () => {
  it("opens add credits and strips the param when landing with openPayment=true", () => {
    const open = vi.fn();
    const routerReplace = vi.fn();
    setup({ searchParamsGet: key => (key === "openPayment" ? "true" : null), routerReplace, open, defaultPaymentMethod: { id: "pm_123" }, isLoading: false });

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "purchase" }));
    expect(routerReplace).toHaveBeenCalledWith("/billing", { scroll: false });
  });

  it("does not open add credits when the openPayment param is absent", () => {
    const open = vi.fn();
    const routerReplace = vi.fn();
    setup({ searchParamsGet: () => null, routerReplace, open, defaultPaymentMethod: { id: "pm_123" }, isLoading: false });

    expect(open).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("does not open add credits while account data is still loading", () => {
    const open = vi.fn();
    const routerReplace = vi.fn();
    setup({ searchParamsGet: key => (key === "openPayment" ? "true" : null), routerReplace, open, defaultPaymentMethod: { id: "pm_123" }, isLoading: true });

    expect(open).not.toHaveBeenCalled();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("opens add credits from the Add Funds button", () => {
    const open = vi.fn();
    setup({ searchParamsGet: () => null, defaultPaymentMethod: undefined, isLoading: false, open });

    fireEvent.click(screen.getByRole("button", { name: /add funds/i }));

    expect(open).toHaveBeenCalledWith(expect.objectContaining({ initialTab: "purchase" }));
  });

  function setup(input: {
    searchParamsGet?: (key: string) => string | null;
    routerReplace?: ReturnType<typeof vi.fn>;
    open?: OpenFn;
    defaultPaymentMethod?: { id: string };
    isLoading?: boolean;
  }) {
    const open: OpenFn = input.open ?? vi.fn();
    const mockReplace = input.routerReplace ?? vi.fn();
    const mockSearchParams = { get: vi.fn(input.searchParamsGet ?? (() => null)) };
    const mockRouter = { replace: mockReplace, push: vi.fn() };

    const MockButton = vi.fn(({ children, ...props }: Parameters<typeof DEPENDENCIES.Button>[0]) => <button {...props}>{children}</button>);

    const dependencies = {
      ...MockComponents(DEPENDENCIES),
      useSnackbar: vi.fn(() => ({ enqueueSnackbar: vi.fn() })),
      useDefaultPaymentMethodQuery: vi.fn(() => ({ data: input.defaultPaymentMethod, isLoading: input.isLoading ?? false })),
      useWalletBalance: vi.fn(() => ({ balance: { totalDeploymentGrantsUSD: 100, totalDeploymentEscrowUSD: 10 }, isLoading: false })),
      useWalletSettingsQuery: vi.fn(() => ({ data: { autoReloadEnabled: false } })),
      useWeeklyDeploymentCostQuery: vi.fn(() => ({ data: 5 })),
      useWalletSettingsMutations: vi.fn(() => ({ upsertWalletSettings: { mutate: vi.fn(), isPending: false } })),
      usePopup: vi.fn(() => ({ confirm: vi.fn() })),
      useSearchParams: vi.fn(() => mockSearchParams),
      useRouter: vi.fn(() => mockRouter),
      useServices: vi.fn(() => ({ urlService: { billing: () => "/billing", paymentMethods: () => "/payment-methods" } })),
      useBillingSheet: vi.fn(() => mock<ReturnType<typeof DEPENDENCIES.useBillingSheet>>({ open })),
      Button: MockButton
    } as unknown as typeof DEPENDENCIES;

    render(<AccountOverview dependencies={dependencies} />);

    return { open, mockReplace };
  }
});
