import { format } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import type { OrganizationOutput } from "@src/types/organization";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, ReferralsPage } from "./ReferralsPage";

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

const COMMISSION_CREATED_AT = "2024-06-10T12:00:00.000Z";
const COMMISSION_SETTLED_AT = "2024-07-10T12:00:00.000Z";
const NEXT_RELEASE_AT = "2024-11-13T12:00:00.000Z";
const COMMISSION_CREATED_ON = format(new Date(COMMISSION_CREATED_AT), "MMM d, yyyy");
const COMMISSION_SETTLED_ON = format(new Date(COMMISSION_SETTLED_AT), "MMM d");
const NEXT_RELEASE_ON = format(new Date(NEXT_RELEASE_AT), "MMM d");

describe(ReferralsPage.name, () => {
  it("redirects to billing and renders nothing when the affiliate program is off", () => {
    const { mockRouter } = setup({ isAffiliateProgramEnabled: false });

    expect(mockRouter.replace).toHaveBeenCalledWith(UrlService.billing());
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
  });

  it("redirects to billing and renders nothing once the profile loads empty for a caller who is not an affiliate", () => {
    const { mockRouter } = setup({ profile: null });

    expect(mockRouter.replace).toHaveBeenCalledWith(UrlService.billing());
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
  });

  it("neither redirects nor renders while the profile is still loading", () => {
    const { mockRouter } = setup({ profile: null, isSuccess: false });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows an error with a retry button instead of redirecting when the profile fails to load", async () => {
    const { mockRouter, refetch, user, SettingsLayout } = setup({ profile: null, isSuccess: false, isError: true });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(SettingsLayout.mock.lastCall?.[0].title).toBe("Referrals");
    expect(screen.getByText("Your referrals couldn't be loaded.")).toBeInTheDocument();
    expect(screen.queryByText("Approved affiliate")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetch).toHaveBeenCalled();
  });

  it("disables the retry button while the profile is being fetched again", () => {
    setup({ profile: null, isSuccess: false, isError: true, isFetching: true });

    expect(screen.getByRole("button", { name: /Try again/ })).toBeDisabled();
  });

  it("keeps showing the page when a refetch fails after the profile loaded", () => {
    setup({ isSuccess: false, isError: true });

    expect(screen.getByLabelText("Referral link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("titles the page, marks the caller as an approved affiliate and shows the referral link", () => {
    const { mockRouter, SettingsLayout } = setup({ profile: buildProfile({ code: "friendcode" }) });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(SettingsLayout.mock.lastCall?.[0].title).toBe("Referrals");
    expect(screen.getByText("Approved affiliate")).toBeInTheDocument();
    expect(screen.getByLabelText("Referral link")).toHaveValue(`${getBaseUrl()}/?ref=friendcode`);
    expect(screen.getByText("Works on any Console page: add ?ref=friendcode to a template or deployment link.")).toBeInTheDocument();
  });

  it("selects the whole referral link when the field gets focus", () => {
    setup({ profile: buildProfile({ code: "friendcode" }) });
    const field = screen.getByLabelText<HTMLInputElement>("Referral link");

    act(() => field.focus());

    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
  });

  it("copies the referral link and shows a success snackbar", async () => {
    const { user, enqueueSnackbar, copyTextToClipboard } = setup({ profile: buildProfile({ code: "friendcode" }) });
    copyTextToClipboard.mockResolvedValue(true);

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(copyTextToClipboard).toHaveBeenCalledWith(`${getBaseUrl()}/?ref=friendcode`);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Referral link copied to clipboard" }) }), {
      variant: "success",
      autoHideDuration: 1500
    });
  });

  it("shows an error snackbar when the copy fails", async () => {
    const { user, enqueueSnackbar, copyTextToClipboard } = setup({ profile: buildProfile() });
    copyTextToClipboard.mockResolvedValue(false);

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the link" }) }), {
      variant: "error"
    });
  });

  it("offers to share the referral link on X, LinkedIn and by email", async () => {
    const { user } = setup({ profile: buildProfile({ code: "friendcode", terms: buildTerms({ referralTrialCreditsUsd: 5 }) }) });
    const link = encodeURIComponent(`${getBaseUrl()}/?ref=friendcode`);
    const message = encodeURIComponent("Deploy on Akash Console and start with $5 in free credits");

    await user.click(screen.getByRole("button", { name: "Share" }));
    const menu = await screen.findByRole("menu");

    expect(within(menu).getByRole("menuitem", { name: "Share on X" })).toHaveAttribute("href", `https://x.com/intent/post?text=${message}&url=${link}`);
    expect(within(menu).getByRole("menuitem", { name: "Share on LinkedIn" })).toHaveAttribute(
      "href",
      `https://www.linkedin.com/sharing/share-offsite/?url=${link}`
    );
    expect(within(menu).getByRole("menuitem", { name: "Share by email" })).toHaveAttribute(
      "href",
      `mailto:?subject=Try%20Akash%20Console&body=${message}%3A%20${link}`
    );
    expect(within(menu).getByRole("menuitem", { name: "Share on X" })).toHaveAttribute("target", "_blank");
    expect(within(menu).getByRole("menuitem", { name: "Share on X" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("explains how it works using the terms the api returned", () => {
    setup({
      profile: buildProfile({ terms: buildTerms({ commissionPercent: 7, commissionMonths: 6, referralTrialCreditsUsd: 12.5, commissionHoldDays: 45 }) })
    });
    const steps = within(screen.getByRole("list", { name: "How it works" })).getAllByRole("listitem");

    expect(steps.map(step => step.textContent)).toEqual([
      "They sign up with your linkand start with $12.5 in free credits",
      "They pay by cardyou earn 7% of every payment for 6 months",
      "45 days later, it lands in your balancespend it on deployments; it can't be withdrawn"
    ]);
  });

  it("says a one-day hold in the singular", () => {
    setup({ profile: buildProfile({ terms: buildTerms({ commissionHoldDays: 1 }) }) });

    expect(screen.getByText("1 day later, it lands in your balance")).toBeInTheDocument();
  });

  it("shows sign-ups, paying share, credited and on hold with the next release", () => {
    setup({
      profile: buildProfile({
        stats: buildStats({
          signups: 8,
          payingUsers: 3,
          creditedUsd: 10.5,
          onHoldUsd: 26,
          nextRelease: { releasesAt: NEXT_RELEASE_AT, amountUsd: 11 }
        })
      })
    });

    expect(tile("Sign-ups")).toHaveTextContent(/^Sign-ups8$/);
    expect(tile("Paying")).toHaveTextContent(/^Paying338% of sign-ups$/);
    expect(tile("Credited")).toHaveTextContent(/^Credited10\.50in your personal balance$/);
    expect(tile("On hold")).toHaveTextContent(new RegExp(`^On hold26\\.00next 11\\.00 on ${NEXT_RELEASE_ON}$`));
  });

  it("invites a new affiliate to share and explains the hold when nothing is due for release", () => {
    setup({ profile: buildProfile({ terms: buildTerms({ commissionHoldDays: 30 }), stats: buildStats({ signups: 0, payingUsers: 0 }) }) });

    expect(tile("Sign-ups")).toHaveTextContent(/^Sign-ups0Share your link to get started$/);
    expect(tile("Paying")).toHaveTextContent(/^Paying0$/);
    expect(tile("On hold")).toHaveTextContent(/^On hold0\.00Held 30 days after each payment$/);
  });

  it("notes that earnings go to the personal account while a team is active", () => {
    setup({ profile: buildProfile(), activeOrganization: mock<OrganizationOutput>({ type: "team", name: "Lumen Labs" }) });

    expect(screen.getByText("Earnings go to your personal account")).toBeInTheDocument();
    expect(screen.getByText(/You're working in Lumen Labs\./)).toBeInTheDocument();
  });

  it("leaves out the personal account note in the personal account", () => {
    setup({ profile: buildProfile(), activeOrganization: mock<OrganizationOutput>({ type: "personal", name: "alice" }) });

    expect(screen.queryByText("Earnings go to your personal account")).not.toBeInTheDocument();
  });

  it("shows the empty-state copy when the affiliate has no commission yet", () => {
    setup({ profile: buildProfile({ commissions: [] }) });

    expect(screen.getByText("No commission yet. You'll see it here when someone you referred pays by card.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Commission history" })).not.toBeInTheDocument();
  });

  it("labels the commission table columns", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission()] }) });

    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Date", "Payment", "Commission", "Status"]);
  });

  it("shows a held commission net of refunds with its release date", () => {
    setup({
      profile: buildProfile({
        commissions: [buildCommission({ status: "on_hold", amountUsd: 10, reversedUsd: 2, paymentUsd: 200, releasesAt: COMMISSION_SETTLED_AT })]
      })
    });

    expect(cells(COMMISSION_CREATED_ON)).toEqual([COMMISSION_CREATED_ON, "200.00", "+8.00", `On hold until ${COMMISSION_SETTLED_ON}`]);
  });

  it("shows a held commission past its release date as on hold with no date", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission({ status: "on_hold", releasesAt: null })] }) });

    expect(cells(COMMISSION_CREATED_ON)[3]).toBe("On hold");
  });

  it("shows a credited commission with its credit date and what was taken back", () => {
    setup({
      profile: buildProfile({
        commissions: [buildCommission({ status: "credited", amountUsd: 5, reversedUsd: 1.5, creditedAt: COMMISSION_SETTLED_AT })]
      })
    });

    expect(cells(COMMISSION_CREATED_ON).slice(2)).toEqual(["+5.00-1.50 taken back", `Credited on ${COMMISSION_SETTLED_ON}`]);
  });

  it("shows a credited commission without a credit date as credited", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission({ status: "credited", creditedAt: null })] }) });

    expect(cells(COMMISSION_CREATED_ON).slice(2)).toEqual(["+5.00", "Credited"]);
  });

  it("shows a canceled commission's amount without counting it as money in", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission({ status: "canceled", amountUsd: 5, reversedUsd: 5 })] }) });

    expect(cells(COMMISSION_CREATED_ON).slice(2)).toEqual(["5.00", "Canceled"]);
  });

  it("shows a reversed commission with what was taken back", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission({ status: "reversed", amountUsd: 5, reversedUsd: 5 })] }) });

    expect(cells(COMMISSION_CREATED_ON).slice(2)).toEqual(["+5.00-5.00 taken back", "Reversed"]);
  });

  it("tones each commission status by what it means for the affiliate", () => {
    setup({
      profile: buildProfile({
        commissions: [
          buildCommission({ id: "held", status: "on_hold" }),
          buildCommission({ id: "credited", status: "credited" }),
          buildCommission({ id: "canceled", status: "canceled" }),
          buildCommission({ id: "reversed", status: "reversed" })
        ]
      })
    });

    const history = screen.getByRole("table", { name: "Commission history" });

    expect(["On hold", "Credited", "Canceled", "Reversed"].map(label => within(history).getByText(label).dataset.tone)).toEqual([
      "pending",
      "success",
      "muted",
      "danger"
    ]);
  });

  it("says when the payment behind a commission is not available", () => {
    setup({ profile: buildProfile({ commissions: [buildCommission({ paymentUsd: null })] }) });

    expect(cells(COMMISSION_CREATED_ON)[1]).toBe("Not available");
  });

  it("states how long commission is held under the history", () => {
    setup({ profile: buildProfile({ terms: buildTerms({ commissionHoldDays: 30 }) }) });

    expect(
      screen.getByText("Commission is held for 30 days in case the payment is refunded or disputed. A refund during the hold cancels it.")
    ).toBeInTheDocument();
  });

  it("checks the affiliate_program flag and enables the profile query only when it is on", () => {
    const { useFlag, useAffiliateProfileQuery } = setup({ profile: buildProfile() });

    expect(useFlag).toHaveBeenCalledWith("affiliate_program");
    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("disables the profile query when the flag is off", () => {
    const { useAffiliateProfileQuery } = setup({ isAffiliateProgramEnabled: false });

    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: false });
  });

  function tile(label: string) {
    return screen.getByRole("heading", { name: label }).parentElement;
  }

  function cells(date: string) {
    return within(screen.getByRole("row", { name: new RegExp(date) }))
      .getAllByRole("cell")
      .map(cell => cell.textContent);
  }

  function buildTerms(overrides: Partial<AffiliateProfile["terms"]> = {}): AffiliateProfile["terms"] {
    return { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5, commissionHoldDays: 30, ...overrides };
  }

  function buildStats(overrides: Partial<AffiliateProfile["stats"]> = {}): AffiliateProfile["stats"] {
    return {
      signups: 0,
      payingUsers: 0,
      totalCommissionUsd: 0,
      monthCommissionUsd: 0,
      creditedUsd: 0,
      onHoldUsd: 0,
      nextRelease: null,
      ...overrides
    };
  }

  function buildCommission(overrides: Partial<AffiliateProfile["commissions"][number]> = {}): AffiliateProfile["commissions"][number] {
    return {
      id: "commission-1",
      createdAt: COMMISSION_CREATED_AT,
      amountUsd: 5,
      reversedUsd: 0,
      status: "credited",
      releasesAt: null,
      creditedAt: null,
      paymentUsd: 100,
      ...overrides
    };
  }

  function buildProfile(overrides: Partial<AffiliateProfile> = {}): AffiliateProfile {
    return {
      code: "friendcode",
      terms: buildTerms(),
      stats: buildStats(),
      commissions: [],
      ...overrides
    };
  }

  function setup(
    input: {
      isAffiliateProgramEnabled?: boolean;
      profile?: AffiliateProfile | null;
      isSuccess?: boolean;
      isError?: boolean;
      isFetching?: boolean;
      activeOrganization?: OrganizationOutput;
    } = {}
  ) {
    const user = userEvent.setup();
    const mockRouter = { replace: vi.fn() };
    const enqueueSnackbar = vi.fn();
    const refetch = vi.fn();
    const copyTextToClipboard = vi.fn<typeof DEPENDENCIES.copyTextToClipboard>();
    const isAffiliateProgramEnabled = input.isAffiliateProgramEnabled ?? true;

    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ headerActions, children }) => (
      <>
        {headerActions}
        {children}
      </>
    ));
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(() => isAffiliateProgramEnabled);
    const useAffiliateProfileQuery = vi.fn<typeof DEPENDENCIES.useAffiliateProfileQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), {
        data: input.profile === undefined ? buildProfile() : input.profile,
        isSuccess: input.isSuccess ?? isAffiliateProgramEnabled,
        isError: input.isError ?? false,
        isFetching: input.isFetching ?? false,
        refetch
      })
    );
    const useActiveOrganization = vi.fn<typeof DEPENDENCIES.useActiveOrganization>(() =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization: input.activeOrganization })
    );
    const FormattedNumber = vi.fn((({ value }: { value: number }) => <>{value.toFixed(2)}</>) as typeof DEPENDENCIES.FormattedNumber);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      SettingsLayout,
      Card: DEPENDENCIES.Card,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>(mockRouter),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useFlag,
      useAffiliateProfileQuery,
      useActiveOrganization,
      copyTextToClipboard,
      FormattedNumber
    });

    render(<ReferralsPage dependencies={dependencies} />);

    return { user, mockRouter, enqueueSnackbar, refetch, copyTextToClipboard, SettingsLayout, Layout, useFlag, useAffiliateProfileQuery };
  }
});
