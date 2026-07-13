import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, HackathonCouponNavEntry } from "./HackathonCouponNavEntry";

import { fireEvent, render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

type SheetProps = Parameters<typeof DEPENDENCIES.AddCreditsSheet>[0];

describe(HackathonCouponNavEntry.name, () => {
  it("renders nothing when the hackathons flag is off", () => {
    setup({ isHackathonsEnabled: false, isTrialing: true });

    expect(screen.queryByRole("button", { name: /Hackathon\? click here/i })).not.toBeInTheDocument();
  });

  it("renders nothing when the flag is on but the user is not trialing", () => {
    setup({ isHackathonsEnabled: true, isTrialing: false });

    expect(screen.queryByRole("button", { name: /Hackathon\? click here/i })).not.toBeInTheDocument();
  });

  it("renders the hackathon trigger when the flag is on and the user is trialing", () => {
    setup({ isHackathonsEnabled: true, isTrialing: true });

    expect(screen.getByRole("button", { name: /Hackathon\? click here/i })).toBeInTheDocument();
  });

  it("opens the add-credits sheet on the coupon tab when the trigger is clicked", () => {
    const { AddCreditsSheet } = setup({ isHackathonsEnabled: true, isTrialing: true });

    fireEvent.click(screen.getByRole("button", { name: /Hackathon\? click here/i }));

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.open).toBe(true);
    expect(sheetProps.initialTab).toBe("coupon");
  });

  it("marks the wallet ready when it is loaded and has an address", () => {
    const { AddCreditsSheet } = setup({ isHackathonsEnabled: true, isTrialing: true, isWalletLoaded: true, address: "akash1abc" });

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.isWalletReady).toBe(true);
  });

  it("marks the wallet not ready when it has no address yet", () => {
    const { AddCreditsSheet } = setup({ isHackathonsEnabled: true, isTrialing: true, isWalletLoaded: true, address: "" });

    const sheetProps = AddCreditsSheet.mock.calls.at(-1)![0] as SheetProps;
    expect(sheetProps.isWalletReady).toBe(false);
  });

  function setup(
    input: {
      isHackathonsEnabled?: boolean;
      isTrialing?: boolean;
      isWalletLoaded?: boolean;
      address?: string;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const AddCreditsSheet = vi.fn(ComponentMock);
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isHackathonsEnabled ?? false;
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        isTrialing: input.isTrialing ?? true,
        isWalletLoaded: input.isWalletLoaded ?? true,
        address: input.address ?? "akash1xyz"
      });

    render(<HackathonCouponNavEntry dependencies={MockComponents(DEPENDENCIES, { useFlag, useWallet, AddCreditsSheet, ...input.dependencies })} />);

    return { AddCreditsSheet };
  }
});
