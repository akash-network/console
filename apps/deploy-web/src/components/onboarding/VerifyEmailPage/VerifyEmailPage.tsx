import React, { useEffect } from "react";
import { NextSeo } from "next-seo";

import Layout, { Loading } from "@src/components/layout/Layout";
import { OnboardingStepIndex } from "@src/components/onboarding/OnboardingContainer/OnboardingContainer";
import { ONBOARDING_STEP_KEY } from "@src/services/storage/keys";
import { UrlService } from "@src/utils/urlUtils";

const DEPENDENCIES = {
  Layout,
  Loading,
  NextSeo,
  UrlService,
  redirect: (url: string) => {
    window.localStorage.setItem(ONBOARDING_STEP_KEY, OnboardingStepIndex.EMAIL_VERIFICATION.toString());
    window.location.href = url;
  }
};

type VerifyEmailPageProps = {
  dependencies?: typeof DEPENDENCIES;
};

export function VerifyEmailPage({ dependencies: d = DEPENDENCIES }: VerifyEmailPageProps) {
  useEffect(() => {
    d.redirect(d.UrlService.onboarding({ returnTo: "/" }));
  }, [d]);

  return (
    <d.Layout>
      <d.NextSeo title="Email Verification" />
      <d.Loading text="Redirecting to email verification..." />
    </d.Layout>
  );
}
