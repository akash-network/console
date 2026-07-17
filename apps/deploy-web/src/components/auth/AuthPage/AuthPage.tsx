"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import { AuthLayout } from "@src/components/auth/AuthLayout/AuthLayout";
import { H100PriceStatus } from "@src/components/gpu/H100PriceStatus/H100PriceStatus";
import { PasswordAuth } from "../PasswordAuth/PasswordAuth";
import { PasswordlessAuthClient } from "../PasswordlessAuth/PasswordlessAuth";

export const DEPENDENCIES = {
  AuthLayout,
  H100PriceStatus,
  NextSeo,
  PasswordAuth,
  PasswordlessAuth: PasswordlessAuthClient,
  useRouter,
  useSearchParams
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AuthPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const forcePassword = searchParams.get("auth") === "password";
  const showPasswordless = !forcePassword;

  useEffect(
    function stripTabParamWhenPasswordless() {
      if (!showPasswordless || !searchParams.has("tab")) return;
      const params = new URLSearchParams(searchParams);
      params.delete("tab");
      const query = params.toString();
      router.replace(query ? `?${query}` : router.pathname, undefined, { shallow: true });
    },
    [showPasswordless, searchParams, router]
  );

  return (
    <d.AuthLayout topRightContent={<d.H100PriceStatus />}>
      <d.NextSeo title="Sign in to Akash Console" />
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 px-3 py-4 sm:px-6 lg:px-0">
        {showPasswordless ? <d.PasswordlessAuth /> : <d.PasswordAuth />}
      </div>
    </d.AuthLayout>
  );
}
