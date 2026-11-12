"use client";

import { GiftIcon } from "lucide-react";

import { useServices } from "@src/context/ServicesProvider";
import { useReferralCodeQuery } from "@src/queries/useReferralCodeQuery";

export const DEPENDENCIES = {
  useReferralCodeQuery
};

export type SignUpTrialOffer = { isReferred: boolean; trialCreditsUsd: number };

export function useSignUpTrialOffer(referralCode: string | undefined, dependencies: typeof DEPENDENCIES = DEPENDENCIES): SignUpTrialOffer {
  const { publicConfig } = useServices();
  const { data: referralCodeCheck } = dependencies.useReferralCodeQuery(referralCode);

  if (referralCodeCheck?.valid && referralCodeCheck.trialCreditsUsd !== undefined) {
    return { isReferred: true, trialCreditsUsd: referralCodeCheck.trialCreditsUsd };
  }

  return { isReferred: false, trialCreditsUsd: publicConfig.NEXT_PUBLIC_TRIAL_CREDITS_AMOUNT };
}

export function ReferralWelcome({ offer }: { offer: SignUpTrialOffer }) {
  if (!offer.isReferred) return null;

  return (
    <div className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left dark:border-neutral-800 dark:bg-neutral-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200/70 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50">
        <GiftIcon className="h-4 w-4" aria-hidden />
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">You were referred to Akash Console</p>
        <p className="text-[13px] text-neutral-500 dark:text-neutral-400">Create your account to start with ${offer.trialCreditsUsd} in free credits.</p>
      </div>
    </div>
  );
}

export function TrialCreditsNotice({ offer }: { offer: SignUpTrialOffer }) {
  return (
    <p className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
      {offer.isReferred
        ? `$${offer.trialCreditsUsd} in credits to deploy your first containers. No card required.`
        : `$${offer.trialCreditsUsd} credit to deploy your first container. No card required.`}
    </p>
  );
}
