import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { VerificationCodeInputRef } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import type { AuthService } from "@src/services/auth/auth/auth.service";
import { DEPENDENCIES, EmailCodeVerify, RESEND_COOLDOWN_SEC } from "./EmailCodeVerify";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(EmailCodeVerify.name, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies the OTP and notifies the parent on success", async () => {
    const onVerified = vi.fn();
    const getCaptchaToken = vi.fn().mockResolvedValue("captcha-1");
    const { authService, captureOnComplete } = setup({ onVerified, getCaptchaToken });
    authService.verifyEmailCode.mockResolvedValue(undefined);

    await act(async () => {
      captureOnComplete()?.("123456");
    });

    await vi.waitFor(() => {
      expect(authService.verifyEmailCode).toHaveBeenCalledWith({ email: "alice@example.com", code: "123456", captchaToken: "captcha-1" });
      expect(onVerified).toHaveBeenCalled();
    });
  });

  it("resets the OTP input when verify fails", async () => {
    const reset = vi.fn();
    const { authService, captureOnComplete } = setup({ injectVerifyRef: mock<VerificationCodeInputRef>({ reset }) });
    authService.verifyEmailCode.mockRejectedValue(new Error("Wrong otp"));

    await act(async () => {
      captureOnComplete()?.("000000");
    });

    await vi.waitFor(() => {
      expect(reset).toHaveBeenCalled();
    });
  });

  it("calls onEditEmail when 'Wrong email? Edit' is clicked", async () => {
    const onEditEmail = vi.fn();
    setup({ onEditEmail });

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEditEmail).toHaveBeenCalledTimes(1);
  });

  it("disables resend during the initial cooldown and enables it when the timer hits zero", async () => {
    setup();

    const resend = screen.getByRole("button", { name: /resend/i });
    expect(resend).toBeDisabled();
    expect(resend).toHaveTextContent(`Resend in ${RESEND_COOLDOWN_SEC}s`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    expect(resend).toBeEnabled();
    expect(resend).toHaveTextContent(/resend code/i);
  });

  it("resends the code and restarts the cooldown on successful resend", async () => {
    const getCaptchaToken = vi.fn().mockResolvedValue("captcha-2");
    const { authService } = setup({ getCaptchaToken });
    authService.startEmailCode.mockResolvedValue(undefined);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    });

    await vi.waitFor(() => {
      expect(authService.startEmailCode).toHaveBeenCalledWith({ email: "alice@example.com", captchaToken: "captcha-2" });
    });
    expect(screen.getByRole("button", { name: /resend/i })).toHaveTextContent(`Resend in ${RESEND_COOLDOWN_SEC}s`);
  });

  function setup(
    input: {
      onVerified?: () => void;
      onEditEmail?: () => void;
      getCaptchaToken?: () => Promise<string>;
      injectVerifyRef?: VerificationCodeInputRef;
    } = {}
  ) {
    const authService = mock<AuthService>();
    const onVerified = input.onVerified ?? vi.fn();
    const onEditEmail = input.onEditEmail ?? vi.fn();
    const getCaptchaToken = input.getCaptchaToken ?? vi.fn().mockResolvedValue("captcha-token");
    let capturedOnComplete: ((code: string) => void) | undefined;

    const VerificationCodeInputMock = forwardRef<VerificationCodeInputRef, { onComplete: (code: string) => void; disabled?: boolean }>(
      function VerificationCodeInputStub(props, ref) {
        capturedOnComplete = props.onComplete;
        useImperativeHandle(ref, () => input.injectVerifyRef ?? mock<VerificationCodeInputRef>());
        return null;
      }
    );

    render(
      <TestContainerProvider services={{ authService: () => authService }}>
        <EmailCodeVerify
          email="alice@example.com"
          getCaptchaToken={getCaptchaToken}
          onEditEmail={onEditEmail}
          onVerified={onVerified}
          dependencies={{ ...DEPENDENCIES, VerificationCodeInput: VerificationCodeInputMock as never }}
        />
      </TestContainerProvider>
    );

    return { authService, onVerified, onEditEmail, captureOnComplete: () => capturedOnComplete };
  }
});
