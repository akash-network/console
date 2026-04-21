"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Spinner } from "@akashnetwork/ui/components";
import { Mail, Refresh } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import { useNotificator } from "@src/hooks/useNotificator";
import type { AppError } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";
import type { VerificationCodeInputRef } from "./VerificationCodeInput";
import { VerificationCodeInput } from "./VerificationCodeInput";

const COOLDOWN_DURATION = 60;

export const DEPENDENCIES = {
  useNotificator,
  extractErrorMessage
};

interface EmailVerificationStepProps {
  sendCode: () => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  dependencies?: typeof DEPENDENCIES;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({ sendCode, verifyCode, dependencies: d = DEPENDENCIES }) => {
  const notificator = d.useNotificator();

  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const codeInputRef = useRef<VerificationCodeInputRef>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setTimeout(() => {
      setCooldownSeconds(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleResendCode = useCallback(async () => {
    setIsResending(true);
    codeInputRef.current?.reset();

    try {
      await sendCode();
      setCooldownSeconds(COOLDOWN_DURATION);
      notificator.success("Verification code sent. Please check your email for the 6-digit code.");
    } catch (error) {
      notificator.error(d.extractErrorMessage(error as AppError));
    } finally {
      setIsResending(false);
    }
  }, [sendCode, notificator, d.extractErrorMessage]);

  const handleVerifyCode = useCallback(
    async (code: string) => {
      setIsVerifying(true);

      try {
        await verifyCode(code);
        notificator.success("Your email has been successfully verified");
      } catch (error) {
        notificator.error(d.extractErrorMessage(error as AppError));
        setTimeout(() => codeInputRef.current?.reset(), 0);
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyCode, notificator, d.extractErrorMessage]
  );

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <Title>Verify Your Email</Title>

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>We've sent a 6-digit verification code to your email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <VerificationCodeInput ref={codeInputRef} onComplete={handleVerifyCode} disabled={isVerifying} />

          <p className="text-sm text-muted-foreground">Didn't receive the code? Check your spam folder or request a new one.</p>

          <Button onClick={handleResendCode} variant="outline" disabled={isResending || isVerifying || cooldownSeconds > 0} className="w-full">
            {isResending ? (
              <>
                <Spinner size="small" className="mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Refresh className="mr-2 h-4 w-4" />
                {cooldownSeconds > 0 ? `Resend Code (${cooldownSeconds}s)` : "Resend Code"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
