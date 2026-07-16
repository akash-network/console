import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type DEPENDENCIES, FundingBanner } from "./FundingBanner";

import { act, fireEvent, render, screen } from "@testing-library/react";

describe(FundingBanner.name, () => {
  it("opens the Add Credits sheet on click and closes it once the purchase completes", () => {
    const { getSheetProps } = setup({});
    expect(getSheetProps().open).toBe(false);

    fireEvent.click(screen.getByRole("button"));
    expect(getSheetProps().open).toBe(true);

    act(() => getSheetProps().onDone(50));
    expect(getSheetProps().open).toBe(false);
  });

  it("marks the sheet wallet-ready when the managed wallet is provisioned", () => {
    const { getSheetProps } = setup({ hasManagedWallet: true });

    expect(getSheetProps().isWalletReady).toBe(true);
  });

  function setup(input: { hasManagedWallet?: boolean }) {
    const AddCreditsSheet = vi.fn<typeof DEPENDENCIES.AddCreditsSheet>(() => <></>);
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ hasManagedWallet: input.hasManagedWallet ?? true });

    render(<FundingBanner dependencies={{ AddCreditsSheet, useWallet }} />);

    return { getSheetProps: () => AddCreditsSheet.mock.calls.at(-1)![0] };
  }
});
