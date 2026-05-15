"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { useMutation } from "@tanstack/react-query";

import type { VerificationCodeInputRef } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import { VerificationCodeInput } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import { useServices } from "@src/context/ServicesProvider";

/** Resend cooldown for the verify screen, in seconds. Tune in one place. */
export const RESEND_COOLDOWN_SEC = 30;

export const DEPENDENCIES = {
  Button,
  RemoteApiError,
  VerificationCodeInput,
  useMutation
};

interface Props {
  email: string;
  getCaptchaToken: () => Promise<string>;
  onEditEmail: () => void;
  onVerified: () => void | Promise<void>;
  dependencies?: typeof DEPENDENCIES;
}

export function EmailCodeVerify({ dependencies: d = DEPENDENCIES, ...props }: Props) {
  const { authService } = useServices();
  const verifyInputRef = useRef<VerificationCodeInputRef>(null);
  const [resendCooldownSec, setResendCooldownSec] = useState(RESEND_COOLDOWN_SEC);

  const verifyMutation = d.useMutation({
    async mutationFn(input: { code: string }) {
      const captchaToken = await props.getCaptchaToken();
      await authService.verifyEmailCode({ email: props.email, code: input.code, captchaToken });
    },
    onMutate: function clearResendErrorBeforeVerify() {
      resendMutation.reset();
    },
    async onSuccess() {
      await props.onVerified();
    },
    onError: function resetVerifyInput() {
      verifyInputRef.current?.reset();
    }
  });

  const resendMutation = d.useMutation({
    async mutationFn() {
      const captchaToken = await props.getCaptchaToken();
      await authService.startEmailCode({ email: props.email, captchaToken });
    },
    onMutate: function clearVerifyErrorBeforeResend() {
      verifyMutation.reset();
    },
    onSuccess() {
      setResendCooldownSec(RESEND_COOLDOWN_SEC);
    }
  });

  useEffect(
    function tickResendCooldown() {
      if (resendCooldownSec <= 0) return;
      const id = setInterval(function decrementResendCooldown() {
        setResendCooldownSec(value => Math.max(0, value - 1));
      }, 1000);
      return function clearResendCooldownInterval() {
        clearInterval(id);
      };
    },
    [resendCooldownSec]
  );

  const isResendDisabled = resendCooldownSec > 0 || resendMutation.isPending;
  const resendLabel = resendCooldownSec > 0 ? `Resend in ${resendCooldownSec}s` : "Resend code";
  const isAnyMutationPending = verifyMutation.isPending || resendMutation.isPending;
  const activeError = isAnyMutationPending ? null : verifyMutation.error ?? resendMutation.error;

  return (
    <>
      <d.RemoteApiError className="w-full" error={activeError} />
      <div className="flex flex-col items-center gap-5 self-stretch">
        <p className="text-sm text-neutral-500">
          Enter the 6-digit code sent to <span className="font-medium text-neutral-900 dark:text-neutral-100">{props.email}</span>.{" "}
          <d.Button variant="link" className="h-auto p-0 align-baseline text-sm" onClick={props.onEditEmail} type="button">
            Wrong email? Edit
          </d.Button>
        </p>
        <d.VerificationCodeInput
          ref={verifyInputRef}
          onComplete={code => verifyMutation.mutate({ code })}
          disabled={verifyMutation.isPending || resendMutation.isPending}
        />
        <p className="text-xs text-neutral-500">Code expires in 10 minutes.</p>
        <d.Button variant="link" className="h-auto p-0 text-sm" disabled={isResendDisabled} onClick={() => resendMutation.mutate()} type="button">
          {resendLabel}
        </d.Button>
      </div>
    </>
  );
}
