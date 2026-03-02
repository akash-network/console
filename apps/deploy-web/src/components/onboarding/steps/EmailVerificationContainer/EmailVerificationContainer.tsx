"use client";
import type { FC, ReactNode } from "react";
import React, { useCallback, useEffect } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";

export const DEPENDENCIES = {
  useCustomUser,
  useServices
};

export type EmailVerificationContainerProps = {
  children: (props: { sendCode: () => Promise<void>; verifyCode: (code: string) => Promise<void> }) => ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const EmailVerificationContainer: FC<EmailVerificationContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { user, checkSession } = d.useCustomUser();
  const { analyticsService, auth } = d.useServices();

  const advance = useCallback(() => {
    analyticsService.track("onboarding_email_verified", {
      category: "onboarding"
    });
    onComplete();
  }, [analyticsService, onComplete]);

  useEffect(() => {
    if (user?.emailVerified) {
      advance();
    }
  }, [user?.emailVerified, advance]);

  const sendCode = useCallback(async () => {
    await auth.sendVerificationCode();
  }, [auth]);

  const verifyCode = useCallback(
    async (code: string) => {
      await auth.verifyEmailCode(code);
      await checkSession();
    },
    [auth, checkSession]
  );

  return <>{children({ sendCode, verifyCode })}</>;
};
