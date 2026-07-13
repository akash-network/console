import { forwardRef, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { VerificationCodeInputRef } from "@src/components/onboarding/steps/EmailVerificationStep/VerificationCodeInput";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
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

  it("calls onEditEmail and tracks wrong_email_clk when 'Wrong email? Edit' is clicked", async () => {
    const onEditEmail = vi.fn();
    const { analyticsService } = setup({ onEditEmail });

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(onEditEmail).toHaveBeenCalledTimes(1);
    expect(analyticsService.track).toHaveBeenCalledWith("wrong_email_clk");
  });

  it("shows the resend cooldown counter on mount and enables resend when it elapses", async () => {
    setup();

    expect(screen.getByRole("button", { name: /resend in \d+s/i })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    expect(screen.getByRole("button", { name: /resend code/i })).toBeEnabled();
  });

  it("shows the resend cooldown counter again after a successful resend", async () => {
    const { authService, analyticsService } = setup();
    authService.startEmailCode.mockResolvedValue(undefined);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /resend code/i }));
    });

    await vi.waitFor(() => {
      expect(authService.startEmailCode).toHaveBeenCalled();
    });
    expect(analyticsService.track).toHaveBeenCalledWith("resend_code_clk");

    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /resend in \d+s/i })).toBeInTheDocument();
    });
  });

  it("shows a verifying indicator while the code is being verified", async () => {
    const { authService, captureOnComplete } = setup();
    authService.verifyEmailCode.mockReturnValue(new Promise<void>(() => {}));

    await act(async () => {
      captureOnComplete()?.("123456");
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/verifying/i)).toBeInTheDocument();
    });
  });

  it("hides the resend button while the code is being resent", async () => {
    const { authService } = setup();
    authService.startEmailCode.mockReturnValue(new Promise<void>(() => {}));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /resend code/i }));
    });

    await vi.waitFor(() => {
      expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
    });
  });

  it("continues the resend cooldown from when the code was last sent", () => {
    setup({ readCodeSentAt: () => Date.now() - 10_000 });

    expect(screen.getByRole("button", { name: /resend in 20s/i })).toBeInTheDocument();
  });

  it("hides the resend control and disables the input while verifying", async () => {
    const { authService, captureOnComplete, getVerifyDisabled } = setup();
    authService.verifyEmailCode.mockReturnValue(new Promise<void>(() => {}));

    await act(async () => {
      captureOnComplete()?.("123456");
    });

    await vi.waitFor(() => {
      expect(getVerifyDisabled()).toBe(true);
      expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
    });
  });

  it("keeps the input disabled and resend hidden after a successful verify while redirecting", async () => {
    const onVerified = vi.fn(() => new Promise<void>(() => {}));
    const { authService, captureOnComplete, getVerifyDisabled } = setup({ onVerified });
    authService.verifyEmailCode.mockResolvedValue(undefined);

    await act(async () => {
      captureOnComplete()?.("123456");
    });

    await vi.waitFor(() => {
      expect(authService.verifyEmailCode).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(getVerifyDisabled()).toBe(true);
      expect(screen.queryByRole("button", { name: /resend/i })).not.toBeInTheDocument();
    });
  });

  it("records the code-send time when resending", async () => {
    const markCodeSent = vi.fn();
    const { authService } = setup({ markCodeSent });
    authService.startEmailCode.mockResolvedValue(undefined);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_COOLDOWN_SEC * 1000);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: /resend code/i }));
    });

    await vi.waitFor(() => {
      expect(markCodeSent).toHaveBeenCalled();
    });
  });

  function setup(
    input: {
      onVerified?: () => void | Promise<void>;
      onEditEmail?: () => void;
      getCaptchaToken?: () => Promise<string>;
      injectVerifyRef?: VerificationCodeInputRef;
      readCodeSentAt?: () => number | null;
      markCodeSent?: () => void;
    } = {}
  ) {
    const authService = mock<AuthService>();
    const analyticsService = mock<AnalyticsService>();
    const onVerified = input.onVerified ?? vi.fn();
    const onEditEmail = input.onEditEmail ?? vi.fn();
    const getCaptchaToken = input.getCaptchaToken ?? vi.fn().mockResolvedValue("captcha-token");
    const markCodeSent = input.markCodeSent ?? vi.fn();
    const readCodeSentAt = input.readCodeSentAt ?? (() => null);
    let capturedOnComplete: ((code: string) => void) | undefined;
    let capturedDisabled: boolean | undefined;

    const VerificationCodeInputMock = forwardRef<VerificationCodeInputRef, { onComplete: (code: string) => void; disabled?: boolean }>(
      function VerificationCodeInputStub(props, ref) {
        capturedOnComplete = props.onComplete;
        capturedDisabled = props.disabled;
        useImperativeHandle(ref, () => input.injectVerifyRef ?? mock<VerificationCodeInputRef>());
        return null;
      }
    );

    render(
      <TestContainerProvider services={{ authService: () => authService, analyticsService: () => analyticsService }}>
        <EmailCodeVerify
          email="alice@example.com"
          getCaptchaToken={getCaptchaToken}
          onEditEmail={onEditEmail}
          onVerified={onVerified}
          dependencies={{ ...DEPENDENCIES, VerificationCodeInput: VerificationCodeInputMock as never, markCodeSent, readCodeSentAt }}
        />
      </TestContainerProvider>
    );

    return {
      authService,
      analyticsService,
      onVerified,
      onEditEmail,
      markCodeSent,
      captureOnComplete: () => capturedOnComplete,
      getVerifyDisabled: () => capturedDisabled
    };
  }
});
