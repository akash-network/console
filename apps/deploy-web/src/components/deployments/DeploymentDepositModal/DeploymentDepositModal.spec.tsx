import { describe, expect, it, vi } from "vitest";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import type { DEPENDENCIES } from "./DeploymentDepositModal";
import { DeploymentDepositModal } from "./DeploymentDepositModal";

import { fireEvent, render, screen } from "@testing-library/react";

describe(DeploymentDepositModal.name, () => {
  describe("ACT deposit UI", () => {
    it("renders radio presets for ACT denom", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
      expect(screen.getByLabelText("25")).toBeInTheDocument();
      expect(screen.getByLabelText("50")).toBeInTheDocument();
      expect(screen.getByLabelText("100")).toBeInTheDocument();
    });

    it("does not render radio presets for non-ACT denom", () => {
      setup({ denom: UAKT_DENOM, denomBalance: 100 });

      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    });

    it("fills input when preset is selected", async () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("50"));

      const input = await screen.findByPlaceholderText("Enter here");
      expect(input).toHaveValue(50);
    });

    it("clears preset when custom amount is entered", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("25"));
      const input = screen.getByPlaceholderText("Enter here");
      fireEvent.change(input, { target: { value: "42" } });

      expect(screen.getByLabelText("25")).not.toBeChecked();
    });

    it("defaults to min amount and enables Continue", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      const continueButton = screen.getByTestId("deposit-modal-continue-button");
      expect(continueButton).not.toBeDisabled();
    });

    it("shows balance in red when balance < selected amount", () => {
      setup({ denom: UACT_DENOM, denomBalance: 10 });

      fireEvent.click(screen.getByLabelText("25"));

      const balanceDisplay = screen.getByTestId("act-balance-display");
      expect(balanceDisplay).toHaveClass("text-destructive");
    });

    it("shows balance in normal color when balance >= selected amount", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("25"));

      const balanceDisplay = screen.getByTestId("act-balance-display");
      expect(balanceDisplay).toHaveClass("text-muted-foreground");
    });

    it("shows below-min message and disables Continue when amount < min", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, denomMin: 10 });

      const input = screen.getByPlaceholderText("Enter here");
      fireEvent.change(input, { target: { value: "5" } });

      expect(screen.getByTestId("act-balance-display")).toHaveTextContent("Minimum deposit amount is 10 ACT");
      expect(screen.getByTestId("act-balance-display")).toHaveClass("text-destructive");
      expect(screen.getByTestId("deposit-modal-continue-button")).toBeDisabled();
    });
  });

  describe("auto-mint", () => {
    it("shows auto-mint notice when ACT balance insufficient but total sufficient", () => {
      setup({ denom: UACT_DENOM, denomBalance: 10, balanceUAKT: 500_000_000 });

      fireEvent.click(screen.getByLabelText("25"));

      expect(screen.getByTestId("act-auto-mint-notice")).toBeInTheDocument();
      expect(screen.getByTestId("deposit-modal-continue-button")).not.toBeDisabled();
    });

    it("shows insufficient total balance alert and disables Continue when total too low", () => {
      setup({ denom: UACT_DENOM, denomBalance: 5, balanceUAKT: 1_000_000 });

      fireEvent.click(screen.getByLabelText("25"));

      expect(screen.getByTestId("act-insufficient-total-balance")).toBeInTheDocument();
      expect(screen.queryByTestId("act-auto-mint-notice")).not.toBeInTheDocument();
      expect(screen.getByTestId("deposit-modal-continue-button")).toBeDisabled();
    });

    it("does not show any mint alert when ACT balance is sufficient", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("25"));

      expect(screen.queryByTestId("act-auto-mint-notice")).not.toBeInTheDocument();
      expect(screen.queryByTestId("act-insufficient-total-balance")).not.toBeInTheDocument();
    });
  });

  describe("managed wallet", () => {
    it("disables Continue when balance < selected amount", () => {
      setup({ denom: UACT_DENOM, denomBalance: 10, isManaged: true });

      fireEvent.click(screen.getByLabelText("$25"));

      expect(screen.getByTestId("deposit-modal-continue-button")).toBeDisabled();
    });

    it("does not show mint alerts for managed wallet", () => {
      setup({ denom: UACT_DENOM, denomBalance: 10, isManaged: true });

      fireEvent.click(screen.getByLabelText("$25"));

      expect(screen.queryByTestId("act-auto-mint-notice")).not.toBeInTheDocument();
      expect(screen.queryByTestId("act-insufficient-total-balance")).not.toBeInTheDocument();
    });

    it("shows $ labels instead of ACT", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, isManaged: true });

      expect(screen.getByText("Select the credits amount")).toBeInTheDocument();
      expect(screen.getByLabelText("$25")).toBeInTheDocument();
      expect(screen.getByLabelText("$50")).toBeInTheDocument();
      expect(screen.getByLabelText("$100")).toBeInTheDocument();
      expect(screen.getByTestId("act-balance-display")).toHaveTextContent("Current Balance: $100.00");
    });

    it("shows $ in below-min message", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, denomMin: 10, isManaged: true });

      const input = screen.getByPlaceholderText("Enter here");
      fireEvent.change(input, { target: { value: "5" } });

      expect(screen.getByTestId("act-balance-display")).toHaveTextContent("Minimum deposit amount is $10");
    });
  });

  describe("submit", () => {
    it("calls onSubmit with udenom amount when Continue is clicked", async () => {
      const { onSubmit } = setup({ denom: UACT_DENOM, denomBalance: 100 });

      fireEvent.click(screen.getByLabelText("25"));
      fireEvent.click(screen.getByTestId("deposit-modal-continue-button"));

      await vi.waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(25_000_000);
      });
    });
  });

  describe("non-ACT denom", () => {
    it("does not show ACT-specific UI", () => {
      setup({ denom: UAKT_DENOM, denomBalance: 100 });

      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(screen.queryByTestId("act-balance-display")).not.toBeInTheDocument();
      expect(screen.queryByTestId("act-auto-mint-notice")).not.toBeInTheDocument();
    });
  });

  describe("subtitle", () => {
    it("renders subtitle when provided", () => {
      setup({ denom: UACT_DENOM, denomBalance: 100, subtitle: "Test subtitle text" });

      expect(screen.getByText("Test subtitle text")).toBeInTheDocument();
    });
  });

  function setup(input: { denom: string; denomBalance: number; denomMin?: number; isManaged?: boolean; balanceUAKT?: number; subtitle?: string }) {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const routerPush = vi.fn();

    const dependencies = {
      useServices: () => ({
        analyticsService: { track: vi.fn() },
        urlService: { mintBurn: () => "/mint-burn", billing: () => "/billing" }
      }),
      useWallet: () => ({ isManaged: input.isManaged ?? false }),
      useWalletBalance: () => ({
        balance: {
          balanceUAKT: input.balanceUAKT ?? 500_000_000,
          balanceUACT: input.denomBalance * 1_000_000
        }
      }),
      usePricing: () => ({ isLoaded: true, price: 1.0, usdToAkt: (v: number) => v }),
      useMintACT: () => ({
        mint: vi.fn(),
        isLoading: false,
        isSuccess: false,
        error: null
      }),
      useBmeParams: () => ({ data: { minMintAct: 5 } }),
      useDenomData: () => ({
        min: input.denomMin ?? 0.5,
        max: input.denomBalance,
        balance: input.denomBalance,
        label: "ACT"
      }),
      useAddFundsVerifiedLoginRequiredEventHandler: () => (fn: () => void) => fn,
      useRouter: () => ({ push: routerPush })
    } as unknown as typeof DEPENDENCIES;

    render(<DeploymentDepositModal denom={input.denom} onCancel={onCancel} onSubmit={onSubmit} subtitle={input.subtitle} dependencies={dependencies} />);

    return { onCancel, routerPush, onSubmit };
  }
});
