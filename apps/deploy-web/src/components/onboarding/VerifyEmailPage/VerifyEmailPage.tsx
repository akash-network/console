import React, { useEffect } from "react";
import { NextSeo } from "next-seo";

import Layout, { Loading } from "@src/components/layout/Layout";
import { UrlService } from "@src/utils/urlUtils";

const DEPENDENCIES = {
  Layout,
  Loading,
  NextSeo,
  UrlService,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  redirect: (url: string) => {
    window.location.replace(url);
  }
};

type VerifyEmailPageProps = {
  dependencies?: typeof DEPENDENCIES;
};

export function VerifyEmailPage({ dependencies: d = DEPENDENCIES }: VerifyEmailPageProps) {
  useEffect(() => {
    d.redirect(d.UrlService.home());
  }, [d]);

  return (
    <d.Layout>
      <d.NextSeo title="Email Verification" />
      <d.Loading text="Redirecting..." />
    </d.Layout>
  );
}
