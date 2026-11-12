import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateReferral, AffiliateReferralPage } from "@src/queries/useAffiliateReferralsQuery";
import { DEPENDENCIES, ReferredPeopleList } from "./ReferredPeopleList";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const JOINED_AT = "2024-06-10T12:00:00.000Z";
const JOINED_ON = format(new Date(JOINED_AT), "MMM d, yyyy");

describe(ReferredPeopleList.name, () => {
  it("shows an empty state when nobody signed up through the link yet", () => {
    setup({ page: buildPage({ referrals: [], total: 0 }) });

    expect(screen.getByText("No one has signed up through your link yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "People you referred" })).not.toBeInTheDocument();
  });

  it("labels the columns", () => {
    setup({ page: buildPage({ referrals: [buildReferral()] }) });

    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
      "Referral",
      "Joined",
      "Status",
      "Commission window",
      "They paid",
      "You earned"
    ]);
  });

  it("shows each referral by its code with join date, status, months left and amounts", () => {
    setup({
      page: buildPage({
        referrals: [
          buildReferral({
            code: "4F2A9C",
            joinedAt: JOINED_AT,
            status: "paying",
            commissionMonthsLeft: 10,
            paidUsd: 580,
            earnedUsd: 29
          })
        ]
      })
    });

    expect(cells("#4F2A9C")).toEqual(["#4F2A9C", JOINED_ON, "Paying", "10 mo left", "580.00", "29.00"]);
  });

  it("fills the window bar by the share of the commission window left", () => {
    setup({ commissionMonths: 12, page: buildPage({ referrals: [buildReferral({ commissionMonthsLeft: 3 })] }) });

    expect(screen.getByRole("progressbar", { name: "Commission window left" })).toHaveAttribute("aria-valuenow", "25");
  });

  it("says the window ended once no months are left", () => {
    setup({ page: buildPage({ referrals: [buildReferral({ code: "B7E0AA", commissionMonthsLeft: 0 })] }) });

    expect(cells("#B7E0AA")[3]).toBe("Ended");
  });

  it("labels and tones each status", () => {
    setup({
      page: buildPage({
        referrals: [
          buildReferral({ code: "AAAAAA", status: "paying" }),
          buildReferral({ code: "BBBBBB", status: "on_trial" }),
          buildReferral({ code: "CCCCCC", status: "inactive" })
        ]
      })
    });

    expect(["Paying", "On trial", "Inactive"].map(label => screen.getByText(label).dataset.tone)).toEqual(["success", "info", "muted"]);
  });

  it("says referrals are shown by a short code only", () => {
    setup({ page: buildPage({ referrals: [buildReferral()] }) });

    expect(screen.getByText("Referrals are shown by a short code, never by name or email.")).toBeInTheDocument();
  });

  it("shows a loading state before the first page arrives", () => {
    setup({ page: undefined });

    expect(screen.getByLabelText("Loading the people you referred")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry when the referrals fail to load", async () => {
    const { user, refetch } = setup({ page: undefined, isError: true });

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("The people you referred couldn't be loaded.")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalled();
  });

  it("disables the retry while the referrals are fetched again", () => {
    setup({ page: undefined, isError: true, isFetching: true });

    expect(screen.getByRole("button", { name: /Try again/ })).toBeDisabled();
  });

  it("hides paging while every referral fits on one page", () => {
    setup({ page: buildPage({ referrals: [buildReferral()], total: 10 }) });

    expect(screen.queryByRole("button", { name: "Next referrals" })).not.toBeInTheDocument();
  });

  it("pages through the referrals and says which ones are shown", async () => {
    const { user, useAffiliateReferralsQuery } = setup({ page: buildPage({ referrals: [buildReferral()], total: 11 }) });

    expect(screen.getByText("1 to 1 of 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous referrals" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next referrals" }));
    expect(useAffiliateReferralsQuery).toHaveBeenLastCalledWith({ pageIndex: 1 });

    await user.click(screen.getByRole("button", { name: "Previous referrals" }));
    expect(useAffiliateReferralsQuery).toHaveBeenLastCalledWith({ pageIndex: 0 });
  });

  it("disables next on the last page", () => {
    setup({ page: buildPage({ referrals: [buildReferral()], total: 11, offset: 10 }) });

    expect(screen.getByText("11 to 11 of 11")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next referrals" })).toBeDisabled();
  });

  function cells(code: string) {
    return within(screen.getByRole("row", { name: new RegExp(code) }))
      .getAllByRole("cell")
      .map(cell => cell.textContent);
  }

  function buildReferral(overrides: Partial<AffiliateReferral> = {}): AffiliateReferral {
    return {
      code: "4F2A9C",
      joinedAt: JOINED_AT,
      status: "paying",
      commissionEndsAt: "2025-06-10T12:00:00.000Z",
      commissionMonthsLeft: 10,
      paidUsd: 0,
      earnedUsd: 0,
      ...overrides
    };
  }

  function buildPage({ referrals, total, offset = 0 }: { referrals: AffiliateReferral[]; total?: number; offset?: number }): AffiliateReferralPage {
    return { referrals, pagination: { total: total ?? referrals.length, limit: 10, offset } };
  }

  function setup(input: { page: AffiliateReferralPage | undefined; isError?: boolean; isFetching?: boolean; commissionMonths?: number }) {
    const user = userEvent.setup();
    const refetch = vi.fn();
    const useAffiliateReferralsQuery = vi.fn<typeof DEPENDENCIES.useAffiliateReferralsQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateReferralsQuery>>(), {
        data: input.page,
        isError: input.isError ?? false,
        isFetching: input.isFetching ?? false,
        refetch
      })
    );
    const FormattedNumber = vi.fn((({ value }: { value: number }) => <>{value.toFixed(2)}</>) as typeof DEPENDENCIES.FormattedNumber);

    render(
      <ReferredPeopleList commissionMonths={input.commissionMonths ?? 12} dependencies={{ ...DEPENDENCIES, useAffiliateReferralsQuery, FormattedNumber }} />
    );

    return { user, refetch, useAffiliateReferralsQuery };
  }
});
