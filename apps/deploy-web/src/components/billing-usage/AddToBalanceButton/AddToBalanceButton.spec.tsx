import { describe, expect, it, vi } from "vitest";

import { AddToBalanceButton, DEPENDENCIES } from "./AddToBalanceButton";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(AddToBalanceButton.name, () => {
  it("opens the add credits sheet and cleans the url when openPayment is true", () => {
    const { mockReplace } = setup({ searchParamsGet: key => (key === "openPayment" ? "true" : null), defaultPaymentMethod: { id: "pm_123" } });

    expect(mockReplace).toHaveBeenCalledWith("/billing", { scroll: false });
    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
  });

  it("does not open the add credits sheet when openPayment is absent", () => {
    const { mockReplace } = setup({ searchParamsGet: () => null });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("add-credits-sheet")).not.toBeInTheDocument();
  });

  it("opens the add credits sheet even without a default payment method", () => {
    setup({ searchParamsGet: key => (key === "openPayment" ? "true" : null), defaultPaymentMethod: undefined });

    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
  });

  it("does not open while the default payment method is still loading", () => {
    const { mockReplace } = setup({
      searchParamsGet: key => (key === "openPayment" ? "true" : null),
      defaultPaymentMethod: { id: "pm_123" },
      isLoadingDefaultPaymentMethod: true
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens the add credits sheet from the Add to Balance button", () => {
    setup({ searchParamsGet: () => null });

    fireEvent.click(screen.getByRole("button", { name: /add to balance/i }));

    expect(screen.getByTestId("add-credits-sheet")).toBeInTheDocument();
  });

  it("shows the payment success animation and closes the sheet when a purchase completes", () => {
    const { dependencies, MockAddCreditsSheet } = setup({
      searchParamsGet: key => (key === "openPayment" ? "true" : null),
      defaultPaymentMethod: { id: "pm_123" }
    });

    act(() => MockAddCreditsSheet.mock.calls.at(-1)![0].onDone(100));

    expect(dependencies.PaymentSuccessAnimation).toHaveBeenCalledWith(expect.objectContaining({ show: true, amount: "100" }), expect.anything());
    expect(MockAddCreditsSheet).toHaveBeenCalledWith(expect.objectContaining({ open: false }), expect.anything());
  });

  it("forwards the granted first-purchase bonus to the payment success animation", () => {
    const { dependencies, MockAddCreditsSheet } = setup({
      searchParamsGet: key => (key === "openPayment" ? "true" : null),
      defaultPaymentMethod: { id: "pm_123" }
    });

    act(() => MockAddCreditsSheet.mock.calls.at(-1)![0].onDone(100, undefined, 10));

    expect(dependencies.PaymentSuccessAnimation).toHaveBeenCalledWith(
      expect.objectContaining({ show: true, amount: "100", bonusAmount: "10" }),
      expect.anything()
    );
  });

  function setup(input: {
    searchParamsGet?: (key: string) => string | null;
    routerReplace?: ReturnType<typeof vi.fn>;
    defaultPaymentMethod?: { id: string };
    isLoadingDefaultPaymentMethod?: boolean;
    isWalletBalanceLoading?: boolean;
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
      useDefaultPaymentMethodQuery: vi.fn(() => ({ data: input.defaultPaymentMethod, isLoading: input.isLoadingDefaultPaymentMethod ?? false })),
      useWalletBalance: vi.fn(() => ({ balance: null, isLoading: input.isWalletBalanceLoading ?? false, refetch: vi.fn() })),
      useSearchParams: vi.fn(() => mockSearchParams),
      useRouter: vi.fn(() => mockRouter),
      useServices: vi.fn(() => ({ urlService: { billing: () => "/billing" } })),
      Button: MockButton,
      AddCreditsSheet: MockAddCreditsSheet
    } as unknown as typeof DEPENDENCIES;

    render(<AddToBalanceButton dependencies={dependencies} />);

    return { dependencies, MockAddCreditsSheet, mockReplace };
  }
});
