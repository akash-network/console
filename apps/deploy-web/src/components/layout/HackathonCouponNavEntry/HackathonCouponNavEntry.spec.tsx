import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { DEPENDENCIES, HackathonCouponNavEntry } from "./HackathonCouponNavEntry";

import { fireEvent, render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

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

  it("opens add credits on the coupon tab when the trigger is clicked", () => {
    const { open } = setup({ isHackathonsEnabled: true, isTrialing: true });

    fireEvent.click(screen.getByRole("button", { name: /Hackathon\? click here/i }));

    expect(open).toHaveBeenCalledWith({ initialTab: "coupon" });
  });

  function setup(input: { isHackathonsEnabled?: boolean; isTrialing?: boolean; dependencies?: Partial<typeof DEPENDENCIES> } = {}) {
    const open = vi.fn();
    const useFlag: typeof DEPENDENCIES.useFlag = () => input.isHackathonsEnabled ?? false;
    const useWallet: typeof DEPENDENCIES.useWallet = () => mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ isTrialing: input.isTrialing ?? true });
    const useBillingSheet: typeof DEPENDENCIES.useBillingSheet = () => mock<ReturnType<typeof DEPENDENCIES.useBillingSheet>>({ open });

    render(<HackathonCouponNavEntry dependencies={MockComponents(DEPENDENCIES, { useFlag, useWallet, useBillingSheet, ...input.dependencies })} />);

    return { open };
  }
});
