"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { FormattedNumber } from "react-intl";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { copyTextToClipboard } from "@akashnetwork/ui/utils";
import { format } from "date-fns";
import { CircleAlert, CopyIcon, FileText, Gift, Info, Share2, Sparkles, UserPlus, Wallet } from "lucide-react";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { SettingsLayout } from "@src/components/layout/SettingsLayout/SettingsLayout";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { ReferredPeopleList } from "@src/components/referrals/ReferredPeopleList/ReferredPeopleList";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useFlag } from "@src/hooks/useFlag";
import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import { useAffiliateProfileQuery } from "@src/queries/useAffiliateProfileQuery";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  SettingsLayout,
  SettingsSection,
  ReferredPeopleList,
  Card,
  FormattedNumber,
  useFlag,
  useAffiliateProfileQuery,
  useActiveOrganization,
  useRouter,
  useSnackbar,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  copyTextToClipboard
};

type Commission = AffiliateProfile["commissions"][number];
type Usd = (value: number) => ReactNode;

const CARD_CLASSES = "rounded-xl p-5 shadow-none sm:px-[22px]";

const COMMISSION_COLUMN_HEADERS = ["Date", "Payment", "Commission", "Status"];

/** Phones stack the date over the status and hide the payment; wider screens give each its own column. */
const COMMISSION_ROW_GRID =
  "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-y-0";

const COMMISSION_STATUS_LABELS: Record<Commission["status"], string> = {
  on_hold: "On hold",
  credited: "Credited",
  canceled: "Canceled",
  reversed: "Reversed"
};

const COMMISSION_STATUS_TONES: Record<Commission["status"], "pending" | "success" | "muted" | "danger"> = {
  on_hold: "pending",
  credited: "success",
  canceled: "muted",
  reversed: "danger"
};

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function ReferralsPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const router = d.useRouter();
  const isAffiliateProgramEnabled = d.useFlag("affiliate_program");
  const { data: profile, isSuccess, errorUpdatedAt, isFetching, refetch } = d.useAffiliateProfileQuery({ enabled: isAffiliateProgramEnabled });
  const { activeOrganization } = d.useActiveOrganization();
  const isNotAnAffiliate = !isAffiliateProgramEnabled || (isSuccess && !profile);
  const hasProfileLoadFailed = errorUpdatedAt > 0;

  useEffect(
    function redirectWhenNotAnApprovedAffiliate() {
      if (isNotAnAffiliate) router.replace(UrlService.billing());
    },
    [isNotAnAffiliate, router]
  );

  if (isNotAnAffiliate || (!profile && !hasProfileLoadFailed)) return null;

  const usd: Usd = value => <d.FormattedNumber value={value} style="currency" currency="usd" currencyDisplay="narrowSymbol" />;

  return (
    <d.Layout disableContainer>
      <d.NextSeo title="Referrals" />

      <d.SettingsLayout
        title="Referrals"
        headerActions={
          profile && (
            <Badge variant="outline" className="gap-1.5 font-medium">
              <Gift className="h-3.5 w-3.5" aria-hidden />
              Approved affiliate
            </Badge>
          )
        }
      >
        {profile ? (
          <>
            {activeOrganization?.type === "team" && (
              <Alert className="flex items-start gap-3 rounded-xl">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <AlertTitle>Earnings go to your personal account</AlertTitle>
                  <AlertDescription className="text-sm text-muted-foreground">
                    You&apos;re working in {activeOrganization.name}. Commission is always added to your personal account balance, whichever organization is
                    active.
                  </AlertDescription>
                </div>
              </Alert>
            )}
            <ShareCard profile={profile} dependencies={d} />
            <StatTiles profile={profile} usd={usd} dependencies={d} />
            <d.ReferredPeopleList commissionMonths={profile.terms.commissionMonths} />
            <CommissionHistory profile={profile} usd={usd} dependencies={d} />
          </>
        ) : (
          <d.Card className={`${CARD_CLASSES} flex flex-col items-center gap-3 py-10 text-center`}>
            <CircleAlert className="h-[22px] w-[22px] text-destructive" aria-hidden />
            <p className="text-sm text-muted-foreground">Your referrals couldn&apos;t be loaded.</p>
            <LoadingButton type="button" variant="outline" size="sm" loading={isFetching} onClick={() => refetch()}>
              Try again
            </LoadingButton>
          </d.Card>
        )}
      </d.SettingsLayout>
    </d.Layout>
  );
}

function ShareCard({ profile, dependencies: d }: { profile: AffiliateProfile; dependencies: typeof DEPENDENCIES }) {
  const { enqueueSnackbar } = d.useSnackbar();
  const referralLink = `${getBaseUrl()}/?ref=${profile.code}`;
  const shareMessage = `Deploy on Akash Console and start with $${profile.terms.referralTrialCreditsUsd} in free credits`;
  const encodedLink = encodeURIComponent(referralLink);
  const encodedMessage = encodeURIComponent(shareMessage);
  const shareTargets = [
    { label: "Share on X", href: `https://x.com/intent/post?text=${encodedMessage}&url=${encodedLink}` },
    { label: "Share on LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}` },
    { label: "Share by email", href: `mailto:?subject=${encodeURIComponent("Try Akash Console")}&body=${encodedMessage}%3A%20${encodedLink}` }
  ];

  const copyReferralLink = async () => {
    const isCopied = await d.copyTextToClipboard(referralLink);

    if (isCopied) {
      enqueueSnackbar(<Snackbar title="Referral link copied to clipboard" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy the link" subTitle="Select it and copy it yourself." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <d.Card className={CARD_CLASSES}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <h3 className="text-sm font-normal text-muted-foreground">Your referral link</h3>
          <div className="flex max-w-xl items-center gap-2">
            <Input className="min-w-0 flex-1 font-medium" readOnly value={referralLink} aria-label="Referral link" onFocus={event => event.target.select()} />
            <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Copy referral link" onClick={copyReferralLink}>
              <CopyIcon className="h-4 w-4" aria-hidden />
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" className="shrink-0 gap-2">
                  <Share2 className="h-4 w-4" aria-hidden />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {shareTargets.map(target => (
                  <DropdownMenuItem key={target.label} asChild>
                    <a href={target.href} target="_blank" rel="noopener noreferrer">
                      {target.label}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="text-[13px] text-muted-foreground">Works on any Console page: add ?ref={profile.code} to a template or deployment link.</p>
        </div>

        <ol aria-label="How it works" className="grid shrink-0 gap-3 text-sm sm:grid-cols-3 lg:w-[420px] lg:grid-cols-1">
          <Step
            icon={<UserPlus className="h-4 w-4" />}
            title="They sign up with your link"
            text={`and start with $${profile.terms.referralTrialCreditsUsd} in free credits`}
          />
          <Step
            icon={<Sparkles className="h-4 w-4" />}
            title="They pay by card"
            text={`you earn ${profile.terms.commissionPercent}% of every payment for ${profile.terms.commissionMonths} months`}
          />
          <Step
            icon={<Wallet className="h-4 w-4" />}
            title={`${formatDays(profile.terms.commissionHoldDays)} later, it lands in your balance`}
            text="spend it on deployments; it can't be withdrawn"
          />
        </ol>
      </div>
    </d.Card>
  );
}

function Step({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

function StatTiles({ profile: { stats, terms }, usd, dependencies: d }: { profile: AffiliateProfile; usd: Usd; dependencies: typeof DEPENDENCIES }) {
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      <StatTile label="Sign-ups" value={stats.signups} hint={stats.signups === 0 ? "Share your link to get started" : undefined} dependencies={d} />
      <StatTile
        label="Paying"
        value={stats.payingUsers}
        hint={stats.signups > 0 ? `${Math.round((stats.payingUsers / stats.signups) * 100)}% of sign-ups` : undefined}
        dependencies={d}
      />
      <StatTile label="Credited" value={usd(stats.creditedUsd)} hint="in your personal balance" dependencies={d} />
      <StatTile
        label="On hold"
        value={usd(stats.onHoldUsd)}
        hint={
          stats.nextRelease ? (
            <>
              next {usd(stats.nextRelease.amountUsd)} on {formatShortDate(stats.nextRelease.releasesAt)}
            </>
          ) : (
            `Held ${formatDays(terms.commissionHoldDays)} after each payment`
          )
        }
        dependencies={d}
      />
    </div>
  );
}

function StatTile({ label, value, hint, dependencies: d }: { label: string; value: ReactNode; hint?: ReactNode; dependencies: typeof DEPENDENCIES }) {
  return (
    <d.Card className={CARD_CLASSES}>
      <h3 className="text-sm font-normal text-muted-foreground">{label}</h3>
      <p className="mt-2 text-[26px] font-bold tabular-nums leading-[1.1] tracking-tight">{value}</p>
      {hint && <p className="mt-1.5 text-[13px] text-muted-foreground">{hint}</p>}
    </d.Card>
  );
}

function CommissionHistory({ profile, usd, dependencies: d }: { profile: AffiliateProfile; usd: Usd; dependencies: typeof DEPENDENCIES }) {
  return (
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
      <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Commission is held for {formatDays(profile.terms.commissionHoldDays)} in case the payment is refunded or disputed. A refund during the hold cancels it.
      </p>
    </d.SettingsSection>
  );
}

function CommissionRow({ commission, usd }: { commission: Commission; usd: Usd }) {
  const isCanceled = commission.status === "canceled";
  const isOnHold = commission.status === "on_hold";

  return (
    <div role="row" className={`${COMMISSION_ROW_GRID} border-t py-3.5 text-sm first:border-t-0 sm:py-4 sm:first:border-t`}>
      <span role="cell">{format(new Date(commission.createdAt), "MMM d, yyyy")}</span>
      <span role="cell" className="hidden tabular-nums text-muted-foreground sm:block">
        {commission.paymentUsd === null ? "Not available" : usd(commission.paymentUsd)}
      </span>
      <span role="cell" className="text-right tabular-nums sm:text-left">
        <span
          data-canceled={isCanceled || undefined}
          className="font-medium text-success data-[canceled]:font-normal data-[canceled]:text-muted-foreground data-[canceled]:line-through"
        >
          {!isCanceled && "+"}
          {usd(isOnHold ? commission.amountUsd - commission.reversedUsd : commission.amountUsd)}
        </span>
        {commission.reversedUsd > 0 && !isCanceled && !isOnHold && (
          <span className="block text-xs font-medium text-muted-foreground">-{usd(commission.reversedUsd)} taken back</span>
        )}
      </span>
      <span role="cell" className="col-span-2 sm:col-span-1">
        <span
          data-tone={COMMISSION_STATUS_TONES[commission.status]}
          className="inline-flex rounded-full bg-muted px-3 py-[3px] text-xs font-medium text-muted-foreground data-[tone=danger]:bg-destructive/15 data-[tone=pending]:bg-warning/15 data-[tone=success]:bg-success/15 data-[tone=danger]:text-destructive data-[tone=pending]:text-warning data-[tone=success]:text-success"
        >
          {describeCommissionStatus(commission)}
        </span>
      </span>
    </div>
  );
}

function describeCommissionStatus({ status, releasesAt, creditedAt }: Commission): string {
  const label = COMMISSION_STATUS_LABELS[status];

  if (status === "on_hold" && releasesAt) return `${label} until ${formatShortDate(releasesAt)}`;
  if (status === "credited" && creditedAt) return `${label} on ${formatShortDate(creditedAt)}`;

  return label;
}

function formatShortDate(isoDate: string): string {
  return format(new Date(isoDate), "MMM d");
}

function formatDays(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}
