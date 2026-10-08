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

  function buildProfile(overrides: Partial<AffiliateProfile> = {}): AffiliateProfile {
    return { code: "friendcode", terms: { commissionPercent: 5, commissionMonths: 12, referralTrialCreditsUsd: 5 }, ...overrides };
  }

  function setup(input: { isAffiliateProgramEnabled: boolean; profile?: AffiliateProfile | null; isLoading?: boolean }) {
    const user = userEvent.setup();
    const mockRouter = { replace: vi.fn() };
    const enqueueSnackbar = vi.fn();
    const copyTextToClipboard = vi.fn<typeof DEPENDENCIES.copyTextToClipboard>();

    const SettingsLayout = vi.fn<typeof DEPENDENCIES.SettingsLayout>(({ children }) => <>{children}</>);
    const Layout = vi.fn<typeof DEPENDENCIES.Layout>(({ children }) => <>{children}</>);

    const dependencies = MockComponents(DEPENDENCIES, {
      Layout,
      SettingsLayout,
      useRouter: () => mock<ReturnType<typeof DEPENDENCIES.useRouter>>(mockRouter),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      useFlag: () => input.isAffiliateProgramEnabled,
      useAffiliateProfileQuery: () =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useAffiliateProfileQuery>>(), {
          data: input.profile === undefined ? null : input.profile,
          isLoading: input.isLoading ?? false
        }),
      copyTextToClipboard
    });

    render(<ReferralsPage dependencies={dependencies} />);

    return { user, mockRouter, enqueueSnackbar, copyTextToClipboard, SettingsLayout, Layout };
  }
});
