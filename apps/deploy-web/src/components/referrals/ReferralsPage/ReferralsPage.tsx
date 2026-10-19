"use client";
import { useEffect } from "react";
import { Button, Input, Snackbar } from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { CopyIcon } from "lucide-react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useFlag } from "@src/hooks/useFlag";
import { useAffiliateProfileQuery } from "@src/queries/useAffiliateProfileQuery";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  SettingsLayout,
  SettingsSection,
  useFlag,
  useAffiliateProfileQuery,
  useRouter,
  useSnackbar,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  copyTextToClipboard
};

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
      </d.SettingsLayout>
    </d.Layout>
  );
}
