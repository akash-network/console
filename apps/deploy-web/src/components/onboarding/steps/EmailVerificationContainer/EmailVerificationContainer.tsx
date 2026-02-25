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
    isEmailVerified: boolean;
    isResending: boolean;
    isVerifying: boolean;
    cooldownSeconds: number;
    verifyError: string | null;
    onResendCode: () => void;
    onVerifyCode: (code: string) => void;
    onContinue: () => void;
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
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const { analyticsService, auth } = d.useServices();
  const hasSentInitialCode = useRef(false);
  const isSendingRef = useRef(false);
  const cooldownRef = useRef(0);

  const isEmailVerified = !!user?.emailVerified;

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    cooldownRef.current = cooldownSeconds;
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        const next = prev <= 1 ? 0 : prev - 1;
        cooldownRef.current = next;
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const sendCode = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!user?.id || isSendingRef.current || cooldownRef.current > 0) return;

      isSendingRef.current = true;
      setIsResending(true);
      setVerifyError(null);
      try {
        const {
          data: { codeSentAt }
        } = await auth.sendVerificationCode(user.id);
        const elapsed = Math.floor((Date.now() - new Date(codeSentAt).getTime()) / 1000);
        const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);
        cooldownRef.current = remaining;
        setCooldownSeconds(remaining);

        if (!silent && elapsed <= 1) {
          enqueueSnackbar(<d.Snackbar title="Verification code sent" subTitle="Please check your email for the 6-digit code" iconVariant="success" />, {
            variant: "success"
          });
        }
      } catch (error) {
        if (!silent) {
          notificator.error("Failed to send verification code. Please try again later");
        }
      } finally {
        isSendingRef.current = false;
        setIsResending(false);
      }
    },
    [user?.id, auth, enqueueSnackbar, d.Snackbar, notificator]
  );

  useEffect(() => {
    if (!isEmailVerified && user?.id && !hasSentInitialCode.current) {
      hasSentInitialCode.current = true;
      sendCode({ silent: true });
    }
  }, [isEmailVerified, user?.id, sendCode]);

  const handleVerifyCode = useCallback(
    async (code: string) => {
      if (!user?.id) return;

      setIsVerifying(true);
      setVerifyError(null);
      try {
        await auth.verifyEmailCode(user.id, code);
        await checkSession();
        enqueueSnackbar(<d.Snackbar title="Email verified" subTitle="Your email has been successfully verified" iconVariant="success" />, {
          variant: "success"
        });
      } catch (error) {
        setVerifyError(d.extractErrorMessage(error as AppError));
      } finally {
        setIsVerifying(false);
      }
    },
    [user?.id, auth, checkSession, enqueueSnackbar, d.Snackbar, d.extractErrorMessage]
  );

  const handleContinue = useCallback(() => {
    if (isEmailVerified) {
      analyticsService.track("onboarding_email_verified", {
        category: "onboarding"
      });
      onComplete();
    }
  }, [isEmailVerified, analyticsService, onComplete]);

  return (
    <>
      {children({
        isEmailVerified,
        isResending,
        isVerifying,
        cooldownSeconds,
        verifyError,
        onResendCode: sendCode,
        onVerifyCode: handleVerifyCode,
        onContinue: handleContinue
      })}
    </>
  );
};
