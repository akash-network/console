import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./HackathonCouponNavEntry";
import { HackathonCouponNavEntry } from "./HackathonCouponNavEntry";

import { fireEvent, render, screen } from "@testing-library/react";

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

  it("opens the app-wide add-credits sheet on the coupon tab when the trigger is clicked", () => {
    const { openAddCredits } = setup({ isHackathonsEnabled: true, isTrialing: true });

    fireEvent.click(screen.getByRole("button", { name: /Hackathon\? click here/i }));

    expect(openAddCredits).toHaveBeenCalledWith({ initialTab: "coupon" });
  });

  function setup(
    input: {
      isHackathonsEnabled?: boolean;
      isTrialing?: boolean;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const openAddCredits = vi.fn();
    const useAddCredits: typeof DEPENDENCIES.useAddCredits = () => openAddCredits;
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isHackathonsEnabled ?? false;
    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      mock<ReturnType<typeof DEPENDENCIES.useWallet>>({
        isTrialing: input.isTrialing ?? true
      });

    render(<HackathonCouponNavEntry dependencies={{ useFlag, useWallet, useAddCredits, ...input.dependencies }} />);

    return { openAddCredits };
  }
});
