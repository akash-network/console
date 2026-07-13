"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { useMutation } from "@tanstack/react-query";

import type { VerificationCodeInputRef } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import { VerificationCodeInput } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import { useServices } from "@src/context/ServicesProvider";
import { markCodeSent, readCodeSentAt } from "../PasswordlessAuth/withPersistedPasswordlessFlow";

/** Resend cooldown in seconds, applied on arrival and after each manual resend. */
export const RESEND_COOLDOWN_SEC = 30;

export const DEPENDENCIES = {
  Button,
  RemoteApiError,
  Spinner,
  VerificationCodeInput,
  markCodeSent,
  readCodeSentAt,
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
  const { authService, analyticsService } = useServices();
  const verifyInputRef = useRef<VerificationCodeInputRef>(null);
  const [resendCooldownSec, setResendCooldownSec] = useState(() => remainingResendCooldownSec(d.readCodeSentAt()));

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
      d.markCodeSent();
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

  const isVerifying = verifyMutation.isPending || verifyMutation.isSuccess;
  const isBusy = isVerifying || resendMutation.isPending;
  const resendLabel = resendCooldownSec > 0 ? `Resend in ${resendCooldownSec}s` : "Resend code";
  const activeError = isBusy ? null : verifyMutation.error ?? resendMutation.error;

  function editEmail() {
    analyticsService.track("wrong_email_clk");
    props.onEditEmail();
  }

  function resendCode() {
    analyticsService.track("resend_code_clk");
    resendMutation.mutate();
  }

  return (
    <>
      <d.RemoteApiError className="w-full" error={activeError} />
      <div className="flex flex-col items-center gap-5 self-stretch">
        <p className="text-sm text-neutral-500">
          Enter the 6-digit code sent to <span className="font-medium text-neutral-900 dark:text-neutral-100">{props.email}</span>.{" "}
          <d.Button variant="link" className="h-auto p-0 align-baseline text-sm" onClick={editEmail} type="button">
            Wrong email? Edit
          </d.Button>
        </p>
        <d.VerificationCodeInput ref={verifyInputRef} onComplete={code => verifyMutation.mutate({ code })} disabled={isBusy} />
        {isVerifying ? (
          <p className="flex items-center gap-2 text-xs text-neutral-500">
            <d.Spinner size="small" /> Verifying...
          </p>
        ) : (
          <p className="text-xs text-neutral-500">Code expires in 10 minutes.</p>
        )}
        {!isBusy && (
          <d.Button variant="link" className="h-auto p-0 text-sm" disabled={resendCooldownSec > 0} onClick={resendCode} type="button">
            {resendLabel}
          </d.Button>
        )}
      </div>
    </>
  );
}

/** Cooldown remaining (whole seconds) given when the code was last sent; full cooldown when the send time is unknown. */
function remainingResendCooldownSec(sentAt: number | null): number {
  if (sentAt == null) return RESEND_COOLDOWN_SEC;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SEC - (Date.now() - sentAt) / 1000));
}
