import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import { DEPENDENCIES, JoinReferralProgram } from "./JoinReferralProgram";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(JoinReferralProgram.name, () => {
  it("explains the program and lists the terms", () => {
    setup({});

    expect(screen.getByRole("heading", { name: "Join the referral program" })).toBeInTheDocument();
    expect(screen.getByText("Share your link. When the people you refer pay by card, you earn Console credit.")).toBeInTheDocument();
    expect(screen.getByText("People you refer start with $5 in free credits.")).toBeInTheDocument();
    expect(screen.getByText("You earn 10% of every card payment they make for 12 months.")).toBeInTheDocument();
    expect(screen.getByText("Earnings are Console credit, held for 30 days, and can't be withdrawn.")).toBeInTheDocument();
  });

  it("states a trial credit that is not whole to the cent", () => {
    setup({ terms: { referralTrialCreditsUsd: 7.5 } });

    expect(screen.getByText("People you refer start with $7.50 in free credits.")).toBeInTheDocument();
  });

  it("describes the first-payment bonus when there is one", () => {
    setup({ terms: { commissionMonths: 3, firstPurchaseBonusUsd: 10, firstPurchaseBonusMinPaymentUsd: 20, firstPurchaseBonusMinUsageUsd: 2.5 } });

    expect(
      screen.getByText(
        "Plus $10 if their first payment is $20 or more, once they've used $2.50 on deployments beyond their trial credit within those 3 months."
      )
    ).toBeInTheDocument();
  });

  it("leaves the bonus line out when the bonus is zero", () => {
    setup({ terms: { firstPurchaseBonusUsd: 0 } });

    expect(screen.queryByText(/first payment/)).not.toBeInTheDocument();
  });

  it("joins the program when the button is clicked", async () => {
    const { user, joinProgram } = setup({});

    await user.click(screen.getByRole("button", { name: "Join the referral program" }));

    expect(joinProgram).toHaveBeenCalledTimes(1);
  });

  it("disables the button while joining", () => {
    setup({ isPending: true });

    expect(screen.getByRole("button", { name: /Join the referral program/ })).toBeDisabled();
  });

  it("keeps the button enabled when not joining", () => {
    setup({});

    expect(screen.getByRole("button", { name: "Join the referral program" })).toBeEnabled();
  });

  it("shows an inline error when joining fails", () => {
    setup({ isError: true });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't join the referral program. Please try again.");
  });

  it("shows no error before an attempt fails", () => {
    setup({});

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  function setup(input: { terms?: Partial<AffiliateProfile["terms"]>; isPending?: boolean; isError?: boolean }) {
    const user = userEvent.setup();
    const joinProgram = vi.fn();
    const terms: AffiliateProfile["terms"] = {
      commissionPercent: 10,
      commissionMonths: 12,
      referralTrialCreditsUsd: 5,
      commissionHoldDays: 30,
      firstPurchaseBonusUsd: 0,
      firstPurchaseBonusMinPaymentUsd: 0,
      firstPurchaseBonusMinUsageUsd: 0,
      ...input.terms
    };
    const dependencies: typeof DEPENDENCIES = {
      Card: DEPENDENCIES.Card,
      useJoinAffiliateProgramMutation: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useJoinAffiliateProgramMutation>>(), {
          mutate: joinProgram,
          isPending: input.isPending ?? false,
          isError: input.isError ?? false
        })
    };

    render(<JoinReferralProgram terms={terms} dependencies={dependencies} />);

    return { user, joinProgram };
  }
});
