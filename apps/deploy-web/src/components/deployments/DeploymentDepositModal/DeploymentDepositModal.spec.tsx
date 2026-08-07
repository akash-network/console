import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { DEPENDENCIES } from "./DeploymentDepositModal";
import { DeploymentDepositModal } from "./DeploymentDepositModal";

import { fireEvent, render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";

describe(DeploymentDepositModal.name, () => {
  describe("credits deposit UI", () => {
    it("renders $ radio presets for ACT denom", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
      expect(screen.getByText("Select the credits amount")).toBeInTheDocument();
      expect(screen.getByLabelText("$25")).toBeInTheDocument();
      expect(screen.getByLabelText("$50")).toBeInTheDocument();
      expect(screen.getByLabelText("$100")).toBeInTheDocument();
      expect(screen.getByTestId("act-balance-display")).toHaveTextContent("Current Balance: $100.00");
    });

    it("does not render radio presets for non-ACT denom", () => {
      setup({ denom: UAKT_DENOM, denomBalance: 100 });

      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });

    it("fills input when preset is selected", async () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("$50"));

      const input = await screen.findByPlaceholderText("Enter here");
      expect(input).toHaveValue(50);
    });

    it("clears preset when custom amount is entered", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("$25"));
      const input = screen.getByPlaceholderText("Enter here");
      fireEvent.change(input, { target: { value: "42" } });

      expect(screen.getByLabelText("$25")).not.toBeChecked();
    });

    it("defaults to min amount and enables Continue", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      const continueButton = screen.getByTestId("deposit-modal-continue-button");
      expect(continueButton).not.toBeDisabled();
    });

    it("shows balance in red and disables Continue when balance < selected amount", () => {
      setup({ denom: UACT_DENOM, denomBalance: 10 });

      fireEvent.click(screen.getByLabelText("$25"));

      const balanceDisplay = screen.getByTestId("act-balance-display");
      expect(balanceDisplay).toHaveClass("text-destructive");
      expect(screen.getByTestId("deposit-modal-continue-button")).toBeDisabled();
    });

    it("shows balance in normal color when balance >= selected amount", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("$25"));

      const balanceDisplay = screen.getByTestId("act-balance-display");
      expect(balanceDisplay).toHaveClass("text-muted-foreground");
    });

    it("shows below-min message in $ and disables Continue when amount < min", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, denomMin: 10 });

      const input = screen.getByPlaceholderText("Enter here");
      fireEvent.change(input, { target: { value: "5" } });

      expect(screen.getByTestId("act-balance-display")).toHaveTextContent("Minimum deposit amount is $10");
      expect(screen.getByTestId("act-balance-display")).toHaveClass("text-destructive");
      expect(screen.getByTestId("deposit-modal-continue-button")).toBeDisabled();
    });
  });

  describe("submit", () => {
    it("calls onSubmit with udenom amount when Continue is clicked", async () => {
      const { onSubmit } = setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("$25"));
      fireEvent.click(screen.getByTestId("deposit-modal-continue-button"));

      await vi.waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(25_000_000);
      });
    });

    it("converts USD amount to AKT for the UAKT denom", async () => {
      const { onSubmit } = setup({ denom: UAKT_DENOM, denomBalance: 100 });

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.click(screen.getByTestId("deposit-modal-continue-button"));

      await vi.waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(15_000_000);
      });
    });
  });

  describe("actions", () => {
    it("always renders the Buy credits action", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      expect(screen.getByTestId("deposit-modal-buy-credits-button")).toBeInTheDocument();
    });
  });

  describe("non-ACT denom", () => {
    it("does not show ACT-specific UI", () => {
      setup({ denom: UAKT_DENOM, denomBalance: 100 });

      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(screen.queryByTestId("act-balance-display")).not.toBeInTheDocument();
    });
  });

  describe("subtitle", () => {
    it("renders subtitle when provided", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, subtitle: "Test subtitle text" });

      expect(screen.getByText("Test subtitle text")).toBeInTheDocument();
    });
  });

  function setup(input: { denom: string; denomBalance: number; denomMin?: number; subtitle?: string }) {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const routerPush = vi.fn();

    const dependencies = mock<typeof DEPENDENCIES>({
      useServices: () =>
        mock<ReturnType<typeof DEPENDENCIES.useServices>>({
          analyticsService: mock<ReturnType<typeof DEPENDENCIES.useServices>["analyticsService"]>({ track: vi.fn() }),
          urlService: mock<ReturnType<typeof DEPENDENCIES.useServices>["urlService"]>({ billing: vi.fn().mockReturnValue("/billing") })
        }),
      useWalletBalance: () => ({
        balance: buildWalletBalance(),
        isLoading: false,
        refetch: vi.fn()
      }),
      usePricing: () =>
        mock<ReturnType<typeof DEPENDENCIES.usePricing>>({
          isLoaded: true,
          price: 1.0,
          usdToAkt: vi.fn((v: number) => v / 2)
        }),
      useDenomData: () => ({
        min: input.denomMin ?? 0.5,
        max: input.denomBalance,
        balance: input.denomBalance,
        label: "USD"
      }),
      useAddFundsVerifiedLoginRequiredEventHandler: () => callback => callback,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push: routerPush })
    });

    render(<DeploymentDepositModal denom={input.denom} onCancel={onCancel} onSubmit={onSubmit} subtitle={input.subtitle} dependencies={dependencies} />);

    return { onCancel, routerPush, onSubmit };
  }
});
