import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WalletBalance } from "@src/hooks/useWalletBalance";
import type { BmeParams } from "@src/types/bme";
import { DEPENDENCIES, MintBurnPage, PRESET_AMOUNTS } from "./MintBurnPage";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildWalletBalance } from "@tests/seeders/walletBalance";

describe(MintBurnPage.name, () => {
  it("displays From balance for current mode", () => {
    setup({
      walletBalance: buildWalletBalance({
        balanceUAKT: 203_080_000,
        balanceUACT: 50_000_000
      })
    });

    expect(screen.getByText(/Balance: 203.08 AKT/)).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByLabelText("Swap tokens"));
    });

    expect(screen.getByText(/Balance: 50 ACT/)).toBeInTheDocument();
  });

  it("defaults to Mint mode with ACT amount of 100", () => {
    setup({ price: 2 });

    expect(screen.getByText("AKT", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("ACT", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toHaveTextContent("Mint ACT");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("100");
  });

  it("computes AKT cost from default ACT amount using oracle rate", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("50");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("100");
  });

  it("swaps denoms when swap button is clicked", () => {
    setup({ price: 2 });

    act(() => {
      fireEvent.click(screen.getByLabelText("Swap tokens"));
    });

    expect(screen.getByRole("button", { name: "Submit" })).toHaveTextContent("Burn ACT");
  });

  it("selects preset amount and updates computed values", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 4
    });

    act(() => {
      fireEvent.click(screen.getByText("$50"));
    });

    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("12.5");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("50");
  });

  it("fills max amount when Everything button is clicked", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 100_000_000 }),
      price: 2
    });

    act(() => {
      fireEvent.click(screen.getByText("Everything"));
    });

    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("100");
  });

  it("shows insufficient balance alert when amount exceeds balance", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 10_000_000 }),
      price: 2
    });

    expect(screen.getByText(/Insufficient AKT balance/)).toBeInTheDocument();
  });

  it("does not show insufficient balance alert when amount is within balance", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    expect(screen.queryByText(/Insufficient/)).not.toBeInTheDocument();
  });

  it("disables submit button when balance is insufficient", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 10_000_000 }),
      price: 2
    });

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("disables submit button when price is not loaded", () => {
    setup({ price: undefined });

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("calls signAndBroadcastTx on submit for minting", async () => {
    const { signAndBroadcastTx } = setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
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
      fireEvent.click(screen.getByLabelText("Swap tokens"));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
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

  it("resets form and invalidates ledger after successful mint", async () => {
    const { invalidateLedger } = setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 2
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    });

    await waitFor(() => {
      expect(invalidateLedger).toHaveBeenCalledTimes(1);
    });
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("");
  });

  it("displays rate information when price is loaded in mint mode", () => {
    setup({ price: 4 });

    expect(screen.getByText(/Rate: 1 AKT = 4 ACT/)).toBeInTheDocument();
  });

  it("displays rate information when price is loaded in burn mode", () => {
    setup({ price: 4 });

    act(() => {
      fireEvent.click(screen.getByLabelText("Swap tokens"));
    });

    expect(screen.getByText(/Rate: 1 ACT = 0.25 AKT/)).toBeInTheDocument();
  });

  it("renders all preset amount buttons", () => {
    setup();

    for (const amount of PRESET_AMOUNTS) {
      expect(screen.getByText(`$${amount}`)).toBeInTheDocument();
    }
    expect(screen.getByText("Everything")).toBeInTheDocument();
  });

  it("renders back to dashboard link", () => {
    setup();

    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("shows info alert about ACT properties", () => {
    setup();

    expect(screen.getByText(/ACT is USD-pegged and used only for deployments/)).toBeInTheDocument();
  });

  it("updates To field when typing in From field", () => {
    setup({ price: 2 });

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;

    act(() => {
      fireEvent.focus(fromInput);
    });

    act(() => {
      fireEvent.change(fromInput, { target: { value: "10" } });
    });

    expect(fromInput.value).toBe("10");
    expect((screen.getByLabelText("To") as HTMLInputElement).value).toBe("20");
  });

  it("updates From field when typing in To field", () => {
    setup({ price: 4 });

    const toInput = screen.getByLabelText("To") as HTMLInputElement;

    act(() => {
      fireEvent.focus(toInput);
    });

    act(() => {
      fireEvent.change(toInput, { target: { value: "40" } });
    });

    expect(toInput.value).toBe("40");
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe("10");
  });

  it("shows below-minimum-mint error when estimated output is below minMintAct", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 0.5,
      bmeParams: { minMintUact: 10_000_000, minMintAct: 10 }
    });

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;

    act(() => {
      fireEvent.focus(fromInput);
    });

    act(() => {
      fireEvent.change(fromInput, { target: { value: "10" } });
    });

    expect(screen.getByText(/below the minimum mint amount of 10 ACT/)).toBeInTheDocument();
  });

  it("does not show below-minimum-mint error in burn mode", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUACT: 1_000_000_000 }),
      price: 0.5,
      bmeParams: { minMintUact: 10_000_000, minMintAct: 10 }
    });

    act(() => {
      fireEvent.click(screen.getByLabelText("Swap tokens"));
    });

    expect(screen.queryByText(/below the minimum mint amount/)).not.toBeInTheDocument();
  });

  it("disables submit button when estimated output is below minMintAct", () => {
    setup({
      walletBalance: buildWalletBalance({ balanceUAKT: 1_000_000_000 }),
      price: 0.5,
      bmeParams: { minMintUact: 10_000_000, minMintAct: 10 }
    });

    const fromInput = screen.getByLabelText("From") as HTMLInputElement;

    act(() => {
      fireEvent.focus(fromInput);
    });

    act(() => {
      fireEvent.change(fromInput, { target: { value: "10" } });
    });

    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  function setup(input?: { walletBalance?: WalletBalance | null; price?: number; bmeParams?: BmeParams }) {
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const refetchBalance = vi.fn();
    const invalidateLedger = vi.fn();
    const enqueueSnackbar = vi.fn();

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
      ArrowUpDown: ({ className }: { className?: string }) => <span className={className} />,
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      Snackbar: ({ title }: { title: string }) => <span>{title}</span>,
      useWallet: () => ({
        address: "akash1testaddress",
        signAndBroadcastTx,
        isCustodial: true
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
      }),
      useSupportsACT: () => true,
      useBmeParams: () => ({ data: input?.bmeParams, isLoading: false }),
      useLedgerRecords: () => ({
        data: null,
        isLoading: false,
        invalidate: invalidateLedger
      }),
      LedgerRecordsTable: () => null
    } as unknown as typeof DEPENDENCIES;

    render(<MintBurnPage dependencies={dependencies} />);

    return { signAndBroadcastTx, refetchBalance, invalidateLedger, enqueueSnackbar };
  }
});
