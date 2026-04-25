import React, { useEffect } from "react";
import { NextSeo } from "next-seo";

import Layout, { Loading } from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

const DEPENDENCIES = {
  Layout,
  Loading,
  NextSeo,
  UrlService,
  redirect: (url: string) => {
    window.location.replace(url);
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
