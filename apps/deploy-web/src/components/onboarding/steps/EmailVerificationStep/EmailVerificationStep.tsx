"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@akashnetwork/ui/components";
import { Mail, Refresh } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface EmailVerificationStepProps {
  isResending: boolean;
  isVerifying: boolean;
  cooldownSeconds: number;
  verifyError: string | null;
  onResendCode: () => void;
  onVerifyCode: (code: string) => void;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({
  isResending,
  isVerifying,
  cooldownSeconds,
  verifyError,
  onResendCode,
  onVerifyCode
}) => {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digitsRef = useRef(digits);
  digitsRef.current = digits;

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
          const code = newDigits.join("");
          if (code.length === 6) {
            onVerifyCode(code);
          } else {
            inputRefs.current[index + filled.length]?.focus();
          }
          return newDigits;
        });
        return;
      }

      setDigits(prev => {
        const newDigits = [...prev];
        newDigits[index] = value;

        if (value && index < 5) {
          inputRefs.current[index + 1]?.focus();
        }

        const code = newDigits.join("");
        if (code.length === 6) {
          onVerifyCode(code);
        }

        return newDigits;
      });
    },
    [isVerifying, onVerifyCode]
  );

  useEffect(() => {
    if (verifyError) {
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }, [verifyError]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digitsRef.current[index] && index > 0) {
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

      if (pasted.length === 6) {
        onVerifyCode(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [isVerifying, onVerifyCode]
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
        </CardContent>
      </Card>
    </div>
  );
};
