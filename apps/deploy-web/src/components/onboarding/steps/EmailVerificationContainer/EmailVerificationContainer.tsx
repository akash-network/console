"use client";
import type { FC, ReactNode } from "react";
import React, { useCallback, useState } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";

const DEPENDENCIES = {
  useCustomUser,
  useSnackbar,
  useServices,
  Snackbar
};

export type EmailVerificationContainerProps = {
  children: (props: {
    isEmailVerified: boolean;
    isResending: boolean;
    isChecking: boolean;
    onResendEmail: () => void;
    onCheckVerification: () => void;
    onContinue: () => void;
  }) => ReactNode;
  onComplete: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const EmailVerificationContainer: FC<EmailVerificationContainerProps> = ({ children, onComplete, dependencies: d = DEPENDENCIES }) => {
  const { user, checkSession } = d.useCustomUser();
  const { enqueueSnackbar } = d.useSnackbar();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const { analyticsService, auth } = d.useServices();

  const isEmailVerified = !!user?.emailVerified;

  const handleResendEmail = useCallback(async () => {
    if (!user?.id) return;

    setIsResending(true);
    try {
      await auth.sendVerificationEmail(user.id);
      enqueueSnackbar(<d.Snackbar title="Verification email sent" subTitle="Please check your email and click the verification link" iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      enqueueSnackbar(<d.Snackbar title="Failed to send verification email" subTitle="Please try again later or contact support" iconVariant="error" />, {
        variant: "error"
      });
    } finally {
      setIsResending(false);
    }
  }, [user?.id, auth, enqueueSnackbar, d.Snackbar]);

  const handleCheckVerification = useCallback(async () => {
    setIsChecking(true);
    try {
      await checkSession();
      enqueueSnackbar(<d.Snackbar title="Verification status updated" subTitle="Your email verification status has been refreshed" iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      enqueueSnackbar(<d.Snackbar title="Failed to check verification" subTitle="Please try again or refresh the page" iconVariant="error" />, {
        variant: "error"
      });
    } finally {
      setIsChecking(false);
    }
  }, [checkSession, enqueueSnackbar, d.Snackbar]);

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
        isChecking,
        onResendEmail: handleResendEmail,
        onCheckVerification: handleCheckVerification,
        onContinue: handleContinue
      })}
    </>
  );
};
