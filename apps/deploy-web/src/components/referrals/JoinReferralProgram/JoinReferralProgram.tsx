"use client";
import { Card, LoadingButton } from "@akashnetwork/ui/components";

import { describeFirstPaymentBonus } from "@src/components/referrals/affiliateTermsCopy";
import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";
import { useJoinAffiliateProgramMutation } from "@src/queries/useJoinAffiliateProgramMutation";

export const DEPENDENCIES = {
  Card,
  useJoinAffiliateProgramMutation
};

type Props = {
  terms: AffiliateProfile["terms"];
  dependencies?: typeof DEPENDENCIES;
};

export function JoinReferralProgram({ terms, dependencies: d = DEPENDENCIES }: Props) {
  const { mutate: joinProgram, isPending, isError } = d.useJoinAffiliateProgramMutation();
  const firstPaymentBonus = describeFirstPaymentBonus(terms);

  return (
    <d.Card className="flex flex-col gap-4 rounded-xl p-5 shadow-none sm:px-[22px]">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Join the referral program</h3>
        <p className="text-sm text-muted-foreground">Share your link. When the people you refer pay by card, you earn Console credit.</p>
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-sm">
        <li>People you refer start with ${terms.referralTrialCreditsUsd} in free credits.</li>
        <li>
          You earn {terms.commissionPercent}% of every card payment they make for {terms.commissionMonths} months.
        </li>
        {firstPaymentBonus && <li>{capitalize(firstPaymentBonus)}.</li>}
        <li>Earnings are Console credit, held for {terms.commissionHoldDays} days, and can&apos;t be withdrawn.</li>
      </ul>
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t join the referral program. Please try again.
        </p>
      )}
      <div>
        <LoadingButton type="button" loading={isPending} disabled={isPending} onClick={() => joinProgram(undefined)}>
          Join the referral program
        </LoadingButton>
      </div>
    </d.Card>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
