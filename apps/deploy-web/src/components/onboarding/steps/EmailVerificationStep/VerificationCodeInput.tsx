"use client";
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Input } from "@akashnetwork/ui/components";

const CODE_LENGTH = 6;

export interface VerificationCodeInputRef {
  reset: () => void;
  focus: () => void;
}

interface VerificationCodeInputProps {
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export const VerificationCodeInput = React.forwardRef<VerificationCodeInputRef, VerificationCodeInputProps>(({ onComplete, disabled = false }, ref) => {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittedCodeRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setDigits(Array(CODE_LENGTH).fill(""));
    submittedCodeRef.current = null;
    inputRefs.current[0]?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      reset,
      focus: () => inputRefs.current[0]?.focus()
    }),
    [reset]
  );

  useEffect(() => {
    const code = digits.join("");
    if (code.length === CODE_LENGTH) {
      if (submittedCodeRef.current !== code) {
        submittedCodeRef.current = code;
        onComplete(code);
      }
    } else {
      submittedCodeRef.current = null;
    }
  }, [digits, onComplete]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d*$/.test(value) || disabled) return;

      if (value.length > 1) {
        const filled = value.slice(0, CODE_LENGTH - index);
        setDigits(prev => {
          const newDigits = [...prev];
          for (let i = 0; i < filled.length; i++) {
            newDigits[index + i] = filled[i];
          }
          return newDigits;
        });
        const nextIndex = index + filled.length;
        if (nextIndex < CODE_LENGTH) {
          inputRefs.current[nextIndex]?.focus();
        }
        return;
      }

      setDigits(prev => {
        const newDigits = [...prev];
        newDigits[index] = value;
        return newDigits;
      });
      if (value && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [disabled]
  );

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const currentDigits = inputRefs.current[index]?.value ?? "";
    if (e.key === "Backspace" && !currentDigits && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (disabled) return;

      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
      if (!pasted) return;

      const newDigits = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < CODE_LENGTH; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setDigits(newDigits);

      if (pasted.length < CODE_LENGTH) {
        inputRefs.current[pasted.length]?.focus();
      }
    },
    [disabled]
  );

  return (
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
          disabled={disabled}
        />
      ))}
    </div>
  );
});
VerificationCodeInput.displayName = "VerificationCodeInput";
