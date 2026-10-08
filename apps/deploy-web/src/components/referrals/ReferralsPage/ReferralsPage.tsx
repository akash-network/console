"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, Input, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { CopyIcon, FileText } from "lucide-react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useFlag } from "@src/hooks/useFlag";
import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import { useAffiliateProfileQuery } from "@src/queries/useAffiliateProfileQuery";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  SettingsLayout,
  SettingsSection,
  Card,
  FormattedNumber,
  useFlag,
  useAffiliateProfileQuery,
  useRouter,
  useSnackbar,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  copyTextToClipboard
};

const COMMISSION_COLUMN_HEADERS = ["Date", "Amount", "Taken back"];

/** Phones stack the date over amount and taken back; wider screens give each its own column. */
const COMMISSION_ROW_GRID = "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-5 sm:grid-cols-[1fr_1fr_1fr] sm:gap-y-0";

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function ReferralsPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const router = d.useRouter();
  const { enqueueSnackbar } = d.useSnackbar();
  const isAffiliateProgramEnabled = d.useFlag("affiliate_program");
  const { data: profile, isLoading } = d.useAffiliateProfileQuery({ enabled: isAffiliateProgramEnabled });
  const canRenderReferralLink = isAffiliateProgramEnabled && !!profile;

  useEffect(
    function redirectWhenNotAnApprovedAffiliate() {
      if (isLoading || canRenderReferralLink) return;
      router.replace(UrlService.billing());
    },
    [isLoading, canRenderReferralLink, router]
  );

  if (!canRenderReferralLink) return null;

  const referralLink = `${getBaseUrl()}/?ref=${profile.code}`;
  const usd = (value: number) => <d.FormattedNumber value={value} style="currency" currency="usd" currencyDisplay="narrowSymbol" />;

  const copyReferralLink = async () => {
    const isCopied = await d.copyTextToClipboard(referralLink);

    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Referral link copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the link" subTitle="Select it and copy it yourself." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <d.Layout disableContainer>
      <d.NextSeo title="Referrals" />

      <d.SettingsLayout title="Referrals">
        <d.SettingsSection title="Your referral link">
          <div className="flex max-w-xl items-center gap-2">
            <Input readOnly value={referralLink} aria-label="Referral link" onFocus={event => event.target.select()} />
            <Button type="button" variant="outline" size="icon" aria-label="Copy referral link" onClick={copyReferralLink}>
              <CopyIcon className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </d.SettingsSection>

        <d.SettingsSection title="Terms">
          <p className="text-sm text-muted-foreground">People who sign up through your link get ${profile.terms.referralTrialCreditsUsd} in free credits.</p>
          <p className="text-sm text-muted-foreground">
            You earn {profile.terms.commissionPercent}% of what they pay by card for {profile.terms.commissionMonths} months, added to your Console balance.
            Commission can be spent on deployments and can&apos;t be withdrawn.
          </p>
        </d.SettingsSection>

        <d.SettingsSection title="Your stats">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatFigure label="Sign-ups" value={profile.stats.signups} />
            <StatFigure label="Paying users" value={profile.stats.payingUsers} />
            <StatFigure label="Total earned" value={usd(profile.stats.totalCommissionUsd)} />
            <StatFigure label="Earned this month" value={usd(profile.stats.monthCommissionUsd)} />
          </div>
        </d.SettingsSection>

        <d.SettingsSection title="Commission history">
          <d.Card className="overflow-hidden rounded-xl shadow-none">
            {profile.commissions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <FileText className="h-[22px] w-[22px] text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">No commission yet. You&apos;ll see it here when someone you referred pays by card.</p>
              </div>
            ) : (
              <div role="table" aria-label="Commission history">
                <div role="rowgroup" className="hidden sm:block">
                  <div role="row" className={`${COMMISSION_ROW_GRID} py-3.5`}>
                    {COMMISSION_COLUMN_HEADERS.map(header => (
                      <span key={header} role="columnheader" className="text-[13px] font-medium">
                        {header}
                      </span>
                    ))}
                  </div>
                </div>
                <div role="rowgroup">
                  {profile.commissions.map(commission => (
                    <CommissionRow key={commission.id} commission={commission} usd={usd} />
                  ))}
                </div>
              </div>
            )}
          </d.Card>
        </d.SettingsSection>
      </d.SettingsLayout>
    </d.Layout>
  );
}

function StatFigure({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
    </div>
  );
}

function CommissionRow({ commission, usd }: { commission: AffiliateProfile["commissions"][number]; usd: (value: number) => ReactNode }) {
  return (
    <div role="row" className={`${COMMISSION_ROW_GRID} border-t py-3.5 first:border-t-0 sm:py-4 sm:first:border-t`}>
      <span role="cell" className="text-sm">
        {new Date(commission.createdAt).toLocaleDateString()}
      </span>
      <span role="cell" className="text-sm">
        {usd(commission.amountUsd)}
      </span>
      <span role="cell" className="text-sm">
        {commission.reversedUsd > 0 ? <span className="text-destructive">-{usd(commission.reversedUsd)}</span> : "—"}
      </span>
    </div>
  );
}
