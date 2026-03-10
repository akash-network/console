import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { DEPENDENCIES, MintBurnPage, PRESET_AMOUNTS } from "./MintBurnPage";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";

describe(MintBurnPage.name, () => {
  it("renders page title and description", () => {
    setup();

    expect(screen.getByText("Mint & Burn")).toBeInTheDocument();
    expect(screen.getByText(/Convert between AKT and ACT/)).toBeInTheDocument();
  });

  it("displays AKT and ACT balances", () => {
    setup({
      walletBalance: buildWalletBalance({
        balanceUAKT: 203_080_000,
        balanceUACT: 50_000_000
      })
    });

    expect(screen.getByTestId("akt-balance")).toHaveTextContent("203.08 AKT");
    expect(screen.getByTestId("act-balance")).toHaveTextContent("50 ACT");
  });

  it("defaults to Mint ACT tab with $100 preset selected", () => {
    setup();

    expect(screen.getByTestId("from-denom")).toHaveTextContent("AKT");
    expect(screen.getByTestId("to-denom")).toHaveTextContent("ACT");
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Mint ACT");
  });

  it("computes AKT cost from preset amount using oracle rate", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    expect(screen.getByTestId("from-amount")).toHaveTextContent("50");
    expect(screen.getByTestId("to-amount")).toHaveTextContent("100");
  });

  it("switches to Burn ACT tab and swaps denoms", () => {
    setup();

    act(() => {
      const burnTab = screen.getByText("Burn ACT");
      burnTab.click();
    });

    expect(screen.getByTestId("from-denom")).toHaveTextContent("ACT");
    expect(screen.getByTestId("to-denom")).toHaveTextContent("AKT");
    expect(screen.getByTestId("submit-button")).toHaveTextContent("Burn ACT");
  });

  it("selects preset amount and updates computed values", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 4
    });

    act(() => {
      fireEvent.click(screen.getByTestId("preset-50"));
    });

    expect(screen.getByTestId("from-amount")).toHaveTextContent("12.5");
    expect(screen.getByTestId("to-amount")).toHaveTextContent("50");
  });

  it("shows custom input when Custom button is clicked", () => {
    setup();

    act(() => {
      fireEvent.click(screen.getByTestId("preset-custom"));
    });

    expect(screen.getByTestId("custom-amount-input")).toBeInTheDocument();
  });

  it("fills max amount when MAX button is clicked", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 100_000_000 }),
      price: 2
    });

    act(() => {
      fireEvent.click(screen.getByTestId("max-button"));
    });

    expect(screen.getByTestId("custom-amount-input")).toBeInTheDocument();
    expect(screen.getByTestId("custom-amount-input")).toHaveValue(200);
  });

  it("shows insufficient balance alert when amount exceeds balance", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 10_000_000 }),
      price: 2
    });

    expect(screen.getByTestId("insufficient-balance-alert")).toBeInTheDocument();
  });

  it("does not show insufficient balance alert when amount is within balance", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    expect(screen.queryByTestId("insufficient-balance-alert")).not.toBeInTheDocument();
  });

  it("disables submit button when balance is insufficient", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 10_000_000 }),
      price: 2
    });

    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("disables submit button when price is not loaded", () => {
    setup({ price: undefined });

    expect(screen.getByTestId("submit-button")).toBeDisabled();
  });

  it("calls signAndBroadcastTx on submit for minting", async () => {
    const { signAndBroadcastTx } = setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-button"));
    });

    expect(signAndBroadcastTx).toHaveBeenCalledTimes(1);
    expect(signAndBroadcastTx).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          typeUrl: expect.stringContaining("MsgMintACT")
        })
      ])
    );
  });

  it("calls signAndBroadcastTx on submit for burning", async () => {
    const { signAndBroadcastTx } = setup({
      walletBalance: buildWalletBalance({ balanceUACT: 500_000_000 }),
      price: 2
    });

    act(() => {
      screen.getByText("Burn ACT").click();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-button"));
    });

    expect(signAndBroadcastTx).toHaveBeenCalledTimes(1);
    expect(signAndBroadcastTx).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          typeUrl: expect.stringContaining("MsgBurnACT")
        })
      ])
    );
  });

  it("shows success snackbar after successful mint", async () => {
    const { enqueueSnackbar, signAndBroadcastTx } = setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });
    signAndBroadcastTx.mockResolvedValue(true);

    await act(async () => {
      fireEvent.click(screen.getByTestId("submit-button"));
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
  });

  it("displays rate information when price is loaded", () => {
    setup({ price: 4 });

    expect(screen.getByTestId("rate-display")).toHaveTextContent("Rate: 1 ACT = $1.00 (0.25 AKT)");
  });

  it("renders all preset amount buttons", () => {
    setup();

    for (const amount of PRESET_AMOUNTS) {
      expect(screen.getByTestId(`preset-${amount}`)).toHaveTextContent(`$${amount}`);
    }
    expect(screen.getByTestId("preset-custom")).toHaveTextContent("Custom");
  });

  it("renders back to dashboard link", () => {
    setup();

    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("shows info alert about ACT properties", () => {
    setup();

    expect(screen.getByText(/ACT is USD-pegged and used only for deployments/)).toBeInTheDocument();
  });

  function setup(input?: { walletBalance?: WalletBalance | null; price?: number }) {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const refetchBalance = vi.fn();
    const enqueueSnackbar = vi.fn();

    const MockTabs: React.FC<{ value: string; onValueChange?: (value: string) => void; children: React.ReactNode }> = ({
      value,
      onValueChange,
      children
    }) => {
      return <div data-value={value}>{React.Children.map(children, child => (React.isValidElement(child) ? React.cloneElement(child, { onValueChange } as Record<string, unknown>) : child))}</div>;
    };

    const MockTabsList: React.FC<{ children: React.ReactNode; className?: string; onValueChange?: (value: string) => void }> = ({
      children,
      className,
      onValueChange
    }) => {
      return (
        <div className={className} role="tablist">
          {React.Children.map(children, child =>
            React.isValidElement(child) ? React.cloneElement(child, { onValueChange } as Record<string, unknown>) : child
          )}
        </div>
      );
    };

    const MockTabsTrigger: React.FC<{ value: string; children: React.ReactNode; className?: string; onValueChange?: (value: string) => void }> = ({
      value,
      children,
      onValueChange
    }) => {
      return (
        <button role="tab" onClick={() => onValueChange?.(value)}>
          {children}
        </button>
      );
    };

    const dependencies = {
      ...DEPENDENCIES,
      Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      Title: ({ children, className }: { children: React.ReactNode; className?: string }) => <h1 className={className}>{children}</h1>,
      Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
          {children}
        </a>
      ),
      NavArrowLeft: ({ className }: { className?: string }) => <span className={className} />,
      ArrowDown: ({ className }: { className?: string }) => <span className={className} />,
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      Snackbar: ({ title }: { title: string }) => <span>{title}</span>,
      Tabs: MockTabs,
      TabsList: MockTabsList,
      TabsTrigger: MockTabsTrigger,
      useWallet: () => ({
        address: "akash1testaddress",
        signAndBroadcastTx
      }),
      useWalletBalance: () => ({
        balance: input?.walletBalance ?? buildWalletBalance({ balanceUAKT: 500_000_000, balanceUACT: 100_000_000 }),
        isLoading: false,
        refetch: refetchBalance
      }),
      usePricing: () => ({
        price: input?.price,
        isLoaded: input?.price !== undefined
      }),
      useSnackbar: () => ({
        enqueueSnackbar
      })
    } as unknown as typeof DEPENDENCIES;

    render(<MintBurnPage dependencies={dependencies} />);

    return { signAndBroadcastTx, refetchBalance, enqueueSnackbar };
  }
});
