"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Spinner } from "@akashnetwork/ui/components";
import { Mail, Refresh } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import { useNotificator } from "@src/hooks/useNotificator";
import type { AppError } from "@src/types";
import { extractErrorMessage } from "@src/utils/errorUtils";

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
  const cooldownRef = useRef(0);
  const isSendingRef = useRef(false);

  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittedCodeRef = useRef<string | null>(null);

  const resetDigits = useCallback(() => {
    setDigits(["", "", "", "", "", ""]);
    submittedCodeRef.current = null;
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setTimeout(() => {
      const next = cooldownSeconds - 1;
      cooldownRef.current = next;
      setCooldownSeconds(next);
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldownSeconds]);

  const handleResendCode = useCallback(async () => {
    if (isSendingRef.current || cooldownRef.current > 0) return;

    isSendingRef.current = true;
    setIsResending(true);
    resetDigits();

    try {
      await sendCode();
      cooldownRef.current = COOLDOWN_DURATION;
      setCooldownSeconds(COOLDOWN_DURATION);
      notificator.success("Verification code sent. Please check your email for the 6-digit code.");
    } catch {
      notificator.error("Failed to send verification code. Please try again later");
    } finally {
      isSendingRef.current = false;
      setIsResending(false);
    }
  }, [sendCode, notificator, resetDigits]);

  const handleVerifyCode = useCallback(
    async (code: string) => {
      setIsVerifying(true);

      try {
        await verifyCode(code);
        notificator.success("Your email has been successfully verified");
      } catch (error) {
        notificator.error(d.extractErrorMessage(error as AppError));
        resetDigits();
      } finally {
        setIsVerifying(false);
      }
    },
    [verifyCode, notificator, d, resetDigits]
  );

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value) || isVerifying) return;

      if (value.length > 1) {
        const filled = value.slice(0, 6 - index);
        setDigits(prev => {
          const newDigits = [...prev];
          for (let i = 0; i < filled.length; i++) {
            newDigits[index + i] = filled[i];
          }
          return newDigits;
        });
        const nextIndex = index + filled.length;
        if (nextIndex < 6) {
          inputRefs.current[nextIndex]?.focus();
        }
        return;
      }

      setDigits(prev => {
        const newDigits = [...prev];
        newDigits[index] = value;
        return newDigits;
      });
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [isVerifying]
  );

  useEffect(() => {
    const code = digits.join("");
    if (code.length === 6) {
      if (submittedCodeRef.current !== code) {
        submittedCodeRef.current = code;
        handleVerifyCode(code);
      }
    } else {
      submittedCodeRef.current = null;
    }
  }, [digits, handleVerifyCode]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentDigits = inputRefs.current[index]?.value ?? "";
    if (e.key === "Backspace" && !currentDigits && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (isVerifying) return;

      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;

      const newDigits = Array(6).fill("");
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setDigits(newDigits);

      if (pasted.length < 6) {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [isVerifying]
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
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <Input
                key={index}
                ref={el => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                aria-label={`Verification code digit ${index + 1}`}
                autoComplete={index === 0 ? "one-time-code" : "off"}
                inputMode="numeric"
                value={digit}
                onChange={e => handleDigitChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="h-12 w-12"
                inputClassName="text-center text-lg font-semibold"
                disabled={isVerifying}
              />
            ))}
          </div>

          <p className="text-sm text-muted-foreground">Didn't receive the code? Check your spam folder or request a new one.</p>

          <Button onClick={handleResendCode} variant="outline" disabled={isResending || isVerifying || cooldownSeconds > 0} className="w-full">
            {isVerifying ? (
              <>
                <Spinner size="small" className="mr-2" />
                Verifying...
              </>
            ) : isResending ? (
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
