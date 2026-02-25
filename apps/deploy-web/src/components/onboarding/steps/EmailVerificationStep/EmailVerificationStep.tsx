"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@akashnetwork/ui/components";
import { Check, Mail, Refresh } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface EmailVerificationStepProps {
  isEmailVerified: boolean;
  isResending: boolean;
  isVerifying: boolean;
  cooldownSeconds: number;
  verifyError: string | null;
  onResendCode: () => void;
  onVerifyCode: (code: string) => void;
  onContinue: () => void;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({
  isEmailVerified,
  isResending,
  isVerifying,
  cooldownSeconds,
  verifyError,
  onResendCode,
  onVerifyCode,
  onContinue
}) => {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value) || isVerifying) return;

      const newDigits = [...digits];
      newDigits[index] = value.slice(-1);
      setDigits(newDigits);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      const code = newDigits.join("");
      if (code.length === 6) {
        onVerifyCode(code);
      }
    },
    [digits, isVerifying, onVerifyCode]
  );

  useEffect(() => {
    if (verifyError) {
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }, [verifyError]);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (isVerifying) return;

      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
      if (!pasted) return;

      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setDigits(newDigits);

      if (pasted.length === 6) {
        onVerifyCode(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [digits, isVerifying, onVerifyCode]
  );

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <Title>Verify Your Email</Title>

      {isEmailVerified && (
        <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="success">
          <div className="rounded-full bg-card p-3">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-medium">Email Verified</h4>
            <p className="text-sm">Your email has been successfully verified.</p>
          </div>
        </Alert>
      )}

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {isEmailVerified ? "Your email has been verified successfully." : "We've sent a 6-digit verification code to your email address."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEmailVerified ? (
            <>
              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((digit, index) => (
                  <Input
                    key={index}
                    ref={el => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="h-12 w-12 text-center text-lg font-semibold"
                    disabled={isVerifying}
                  />
                ))}
              </div>

              {verifyError && (
                <Alert className="text-left" variant="destructive">
                  <p className="text-sm">{verifyError}</p>
                </Alert>
              )}

              {isVerifying && <p className="text-sm text-muted-foreground">Verifying...</p>}

              <p className="text-sm text-muted-foreground">Didn't receive the code? Check your spam folder or request a new one.</p>

              <Button onClick={onResendCode} variant="outline" disabled={isResending || cooldownSeconds > 0} className="w-full">
                <Refresh className="mr-2 h-4 w-4" />
                {isResending ? "Sending..." : cooldownSeconds > 0 ? `Resend Code (${cooldownSeconds}s)` : "Resend Code"}
              </Button>
            </>
          ) : (
            <Button onClick={onContinue} className="w-full">
              Continue
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
