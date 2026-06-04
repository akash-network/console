"use client";

import { NextSeo } from "next-seo";

import { AuthLayout } from "@src/components/auth/AuthLayout/AuthLayout";
import { H100PriceStatus } from "@src/components/gpu/H100PriceStatus/H100PriceStatus";
import { useFlag } from "@src/hooks/useFlag";
import { PasswordAuth } from "../PasswordAuth/PasswordAuth";
import { PasswordlessAuthClient } from "../PasswordlessAuth/PasswordlessAuth";

export const DEPENDENCIES = {
  AuthLayout,
  H100PriceStatus,
  NextSeo,
  PasswordAuth,
  PasswordlessAuth: PasswordlessAuthClient,
  useFlag
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AuthPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const isPasswordless = d.useFlag("console_auth_passwordless");
  return (
    <d.AuthLayout topRightContent={<d.H100PriceStatus />}>
      <d.NextSeo title="Sign in to Akash Console" />
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6 px-3 py-4 sm:px-6 lg:px-0">
        {isPasswordless ? <d.PasswordlessAuth /> : <d.PasswordAuth />}
      </div>
    </d.AuthLayout>
  );
}
