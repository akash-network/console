"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Spinner } from "@akashnetwork/ui/components";
import { Mail, Refresh } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface EmailVerificationStepProps {
  isResending: boolean;
  isVerifying: boolean;
  cooldownSeconds: number;
  onResendCode: () => void;
  onVerifyCode: (code: string) => void;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({
  isResending,
  isVerifying,
  cooldownSeconds,
  onResendCode,
  onVerifyCode
}) => {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      onVerifyCode(code);
    }
  }, [digits, onVerifyCode]);

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

          <Button onClick={onResendCode} variant="outline" disabled={isResending || isVerifying || cooldownSeconds > 0} className="w-full">
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
