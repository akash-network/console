"use client";
import type { FC, ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useNotificator } from "@src/hooks/useNotificator";
import type { AppError } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";

const COOLDOWN_DURATION = 60;

const DEPENDENCIES = {
  useCustomUser,
  useSnackbar,
  useServices,
  Snackbar,
  useNotificator,
  extractErrorMessage
};

export type EmailVerificationContainerProps = {
  children: (props: {
    isResending: boolean;
    isVerifying: boolean;
    cooldownSeconds: number;
    resetKey: number;
    onResendCode: () => void;
    onVerifyCode: (code: string) => void;
  }) => ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const EmailVerificationContainer: FC<EmailVerificationContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { user, checkSession } = d.useCustomUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const notificator = d.useNotificator();
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const { analyticsService, auth } = d.useServices();
  const isSendingRef = useRef(false);
  const cooldownRef = useRef(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setTimeout(() => {
      const next = cooldownSeconds - 1;
      cooldownRef.current = next;
      setCooldownSeconds(next);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const sendCode = useCallback(async () => {
    if (!user?.id || isSendingRef.current || cooldownRef.current > 0) return;

    isSendingRef.current = true;
    setIsResending(true);
    setResetKey(prev => prev + 1);

    try {
      await auth.sendVerificationCode({ resend: true });
      cooldownRef.current = COOLDOWN_DURATION;
      setCooldownSeconds(COOLDOWN_DURATION);

      enqueueSnackbar(<d.Snackbar title="Verification code sent" subTitle="Please check your email for the 6-digit code" iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      notificator.error("Failed to send verification code. Please try again later");
    } finally {
      isSendingRef.current = false;
      setIsResending(false);
    }
  }, [user?.id, auth, enqueueSnackbar, d.Snackbar, notificator]);

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

  const handleVerifyCode = useCallback(
    async (code: string) => {
      if (!user?.id) return;

      setIsVerifying(true);

      try {
        await auth.verifyEmailCode(code);
        await checkSession();
        enqueueSnackbar(<d.Snackbar title="Email verified" subTitle="Your email has been successfully verified" iconVariant="success" />, {
          variant: "success"
        });
        advance();
      } catch (error) {
        notificator.error(d.extractErrorMessage(error as AppError));
      } finally {
        setIsVerifying(false);
      }
    },
    [user?.id, auth, checkSession, enqueueSnackbar, d.Snackbar, d.extractErrorMessage, advance]
  );

  return (
    <>
      {children({
        isResending,
        isVerifying,
        cooldownSeconds,
        resetKey,
        onResendCode: sendCode,
        onVerifyCode: handleVerifyCode
      })}
    </>
  );
};
