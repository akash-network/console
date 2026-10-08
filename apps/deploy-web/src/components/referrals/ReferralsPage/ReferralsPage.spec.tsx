import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import { DEPENDENCIES, ReferralsPage } from "./ReferralsPage";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";

describe(ReferralsPage.name, () => {
  it("redirects to billing and renders nothing when the affiliate program is off", () => {
    const { mockRouter } = setup({ isAffiliateProgramEnabled: false });

    expect(mockRouter.replace).toHaveBeenCalledWith(UrlService.billing());
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
  });

  it("redirects to billing and renders nothing for a caller with no affiliate profile", () => {
    const { mockRouter } = setup({ isAffiliateProgramEnabled: true, profile: null });

    expect(mockRouter.replace).toHaveBeenCalledWith(UrlService.billing());
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
  });

  it("does not redirect while the profile is still loading", () => {
    const { mockRouter } = setup({ isAffiliateProgramEnabled: true, profile: null, isLoading: true });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Referral link")).not.toBeInTheDocument();
  });

  it("titles the page and shows the referral link for an approved affiliate", () => {
    const { mockRouter, SettingsLayout } = setup({ isAffiliateProgramEnabled: true, profile: buildProfile({ code: "friendcode" }) });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(SettingsLayout.mock.lastCall?.[0].title).toBe("Referrals");
    expect(screen.getByLabelText("Referral link")).toHaveValue(`${getBaseUrl()}/?ref=friendcode`);
  });

  it("shows the terms using the values the api returned", () => {
    setup({
      isAffiliateProgramEnabled: true,
      profile: buildProfile({ terms: { commissionPercent: 7, commissionMonths: 6, referralTrialCreditsUsd: 12.5 } })
    });

    expect(screen.getByText(/get \$12\.5 in free credits/)).toBeInTheDocument();
    expect(screen.getByText(/You earn 7% of what they pay by card for 6 months/)).toBeInTheDocument();
  });

  it("copies the referral link and shows a success snackbar", async () => {
    const { user, enqueueSnackbar, copyTextToClipboard } = setup({ isAffiliateProgramEnabled: true, profile: buildProfile({ code: "friendcode" }) });
    copyTextToClipboard.mockResolvedValue(true);

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(copyTextToClipboard).toHaveBeenCalledWith(`${getBaseUrl()}/?ref=friendcode`);
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Referral link copied to clipboard" }) }), {
      variant: "success",
      autoHideDuration: 1500
    });
  });

  it("shows an error snackbar when the copy fails", async () => {
    const { user, enqueueSnackbar, copyTextToClipboard } = setup({ isAffiliateProgramEnabled: true, profile: buildProfile() });
    copyTextToClipboard.mockResolvedValue(false);

    await user.click(screen.getByRole("button", { name: "Copy referral link" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't copy the link" }) }), {
      variant: "error"
    });
  });

  it("shows the stats row with sign-ups, paying users, total earned and earned this month", () => {
    setup({
      isAffiliateProgramEnabled: true,
      profile: buildProfile({ stats: { signups: 9, payingUsers: 4, totalCommissionUsd: 125.5, monthCommissionUsd: 12.25 } })
    });

    expect(screen.getByText("Sign-ups").nextSibling).toHaveTextContent("9");
    expect(screen.getByText("Paying users").nextSibling).toHaveTextContent("4");
    expect(screen.getByText("Total earned").nextSibling).toHaveTextContent("125.50");
    expect(screen.getByText("Earned this month").nextSibling).toHaveTextContent("12.25");
  });

  it("shows the empty-state copy when the affiliate has no commission yet", () => {
    setup({ isAffiliateProgramEnabled: true, profile: buildProfile({ commissions: [] }) });

    expect(screen.getByText("No commission yet. You'll see it here when someone you referred pays by card.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Commission history" })).not.toBeInTheDocument();
  });

  it("lists each commission with its date and gross amount", () => {
    setup({
      isAffiliateProgramEnabled: true,
      profile: buildProfile({
        commissions: [{ id: "commission-1", createdAt: "2024-06-10T12:00:00.000Z", amountUsd: 5, reversedUsd: 0 }]
      })
    });

    const row = screen.getByRole("row", { name: /6\/10\/2024/ });

    expect(row).toHaveTextContent("5.00");
  });

  it("shows a reversed commission's taken-back amount as a deduction", () => {
    setup({
      isAffiliateProgramEnabled: true,
      profile: buildProfile({
        commissions: [{ id: "commission-1", createdAt: "2024-06-10T12:00:00.000Z", amountUsd: 5, reversedUsd: 1.5 }]
      })
    });

    const row = screen.getByRole("row", { name: /6\/10\/2024/ });

    expect(row).toHaveTextContent("-1.50");
  });

  it("checks the affiliate_program flag and enables the profile query only when it is on", () => {
    const { useFlag, useAffiliateProfileQuery } = setup({ isAffiliateProgramEnabled: true, profile: buildProfile() });

    expect(useFlag).toHaveBeenCalledWith("affiliate_program");
    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("disables the profile query when the flag is off", () => {
    const { useAffiliateProfileQuery } = setup({ isAffiliateProgramEnabled: false });

    expect(useAffiliateProfileQuery).toHaveBeenCalledWith({ enabled: false });
  });

  function buildProfile(overrides: Partial<AffiliateProfile> = {}): AffiliateProfile {
    return {
      code: "friendcode",
      terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 },
      stats: { signups: 0, payingUsers: 0, totalCommissionUsd: 0, monthCommissionUsd: 0 },
      commissions: [],
      ...overrides
    };
  }

  function setup(input: { isAffiliateProgramEnabled: boolean; profile?: AffiliateProfile | null; isLoading?: boolean }) {
    const user = userEvent.setup();
    const mockRouter = { replace: vi.fn() };
    const enqueueSnackbar = vi.fn();
    const copyTextToClipboard = vi.fn<typeof DEPENDENCIES.copyTextToClipboard>();

    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ children }) => <>{children}</>);
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);
    const useFlag = vi.fn<typeof DEPENDENCIES.useFlag>(() => input.isAffiliateProgramEnabled);
    const useAffiliateProfileQuery = vi.fn<typeof DEPENDENCIES.useAffiliateProfileQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), {
        data: input.profile === undefined ? null : input.profile,
        isLoading: input.isLoading ?? false
      })
    );
    const FormattedNumber = vi.fn((({ value }: { value: number }) => <>{value.toFixed(2)}</>) as typeof DEPENDENCIES.FormattedNumber);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      SettingsLayout,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>(mockRouter),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useFlag,
      useAffiliateProfileQuery,
      copyTextToClipboard,
      FormattedNumber
    });

    render(<ReferralsPage dependencies={dependencies} />);

    return { user, mockRouter, enqueueSnackbar, copyTextToClipboard, SettingsLayout, Layout, useFlag, useAffiliateProfileQuery };
  }
});
