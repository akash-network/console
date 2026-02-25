import React from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

import { EmailVerificationContainer } from "./EmailVerificationContainer";

import { act, render } from "@testing-library/react";

describe("EmailVerificationContainer", () => {
  it("should render children with initial state", () => {
    const { child } = setup();

    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        isEmailVerified: false,
        isResending: false,
        isVerifying: false,
        cooldownSeconds: expect.any(Number),
        verifyError: null,
        onResendCode: expect.any(Function),
        onVerifyCode: expect.any(Function),
        onContinue: expect.any(Function)
      })
    );
  });

  it("should auto-send code on mount when email is not verified", () => {
    const { mockSendVerificationCode } = setup();

    expect(mockSendVerificationCode).toHaveBeenCalled();
  });

  it("should not auto-send code when email is already verified", () => {
    const { mockSendVerificationCode } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("should handle resend code success and show snackbar for freshly sent code", async () => {
    const { child, mockSendVerificationCode, mockEnqueueSnackbar } = setup();

    await act(async () => {});

    mockSendVerificationCode.mockResolvedValue({ data: { codeSentAt: new Date().toISOString() } });

    const { onResendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onResendCode();
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Verification code sent",
          subTitle: "Please check your email for the 6-digit code",
          iconVariant: "success"
        })
      }),
      { variant: "success" }
    );
  });

  it("should not show snackbar when code was already sent recently (cooldown return)", async () => {
    const { child, mockSendVerificationCode, mockEnqueueSnackbar } = setup();

    await act(async () => {});

    mockSendVerificationCode.mockResolvedValue({ data: { codeSentAt: new Date(Date.now() - 30_000).toISOString() } });

    const { onResendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onResendCode();
    });

    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it("should not resend code while cooldown is active", async () => {
    const { child, mockSendVerificationCode } = setup();

    await act(async () => {});

    mockSendVerificationCode.mockClear();
    mockSendVerificationCode.mockResolvedValue({ data: { codeSentAt: new Date().toISOString() } });

    const { onResendCode: firstResend } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await firstResend();
    });

    expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);
    mockSendVerificationCode.mockClear();

    const { onResendCode: secondResend } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await secondResend();
    });

    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("should handle resend code error", async () => {
    const { child, mockSendVerificationCode, mockNotificator } = setup();

    await act(async () => {});

    mockSendVerificationCode.mockRejectedValue(new Error("Failed"));

    const { onResendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onResendCode();
    });

    expect(mockNotificator.error).toHaveBeenCalledWith("Failed to send verification code. Please try again later");
  });

  it("should handle verify code success", async () => {
    const { child, mockVerifyEmailCode, mockCheckSession, mockEnqueueSnackbar } = setup();
    mockVerifyEmailCode.mockResolvedValue({ emailVerified: true });
    mockCheckSession.mockResolvedValue(undefined);

    const { onVerifyCode } = child.mock.calls[0][0];
    await act(async () => {
      await onVerifyCode("123456");
    });

    expect(mockVerifyEmailCode).toHaveBeenCalledWith("123456");
    expect(mockCheckSession).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Email verified",
          subTitle: "Your email has been successfully verified",
          iconVariant: "success"
        })
      }),
      { variant: "success" }
    );
  });

  it("should handle verify code error", async () => {
    const { child, mockVerifyEmailCode } = setup();
    mockVerifyEmailCode.mockRejectedValue(new Error("Invalid verification code"));

    const { onVerifyCode } = child.mock.calls[0][0];
    await act(async () => {
      await onVerifyCode("000000");
    });

    const lastCall = child.mock.calls[child.mock.calls.length - 1][0];
    expect(lastCall.verifyError).toBe("Invalid verification code");
  });

  it("should call onComplete when email is verified", () => {
    const mockOnComplete = vi.fn();
    const { child } = setup({
      user: { id: "test-user", emailVerified: true },
      onComplete: mockOnComplete
    });

    const { onContinue } = child.mock.calls[0][0];
    onContinue();

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("should not call onComplete when email is not verified", () => {
    const mockOnComplete = vi.fn();
    const { child } = setup({
      user: { id: "test-user", emailVerified: false },
      onComplete: mockOnComplete
    });

    const { onContinue } = child.mock.calls[0][0];
    onContinue();

    expect(mockOnComplete).not.toHaveBeenCalled();
  });

  function setup(input: { user?: any; onComplete?: Mock } = {}) {
    const mockSendVerificationCode = vi.fn().mockResolvedValue({ data: { codeSentAt: new Date(Date.now() - 61_000).toISOString() } });
    const mockVerifyEmailCode = vi.fn();
    const mockCheckSession = vi.fn();
    const mockEnqueueSnackbar = vi.fn();
    const mockAnalyticsService = {
      track: vi.fn()
    };

    const mockUseCustomUser = vi.fn().mockReturnValue({
      user: input.user || { id: "test-user", emailVerified: false },
      checkSession: mockCheckSession
    });

    const mockUseSnackbar = vi.fn().mockReturnValue({
      enqueueSnackbar: mockEnqueueSnackbar
    });

    const mockUseServices = vi.fn().mockReturnValue({
      analyticsService: mockAnalyticsService,
      auth: {
        sendVerificationCode: mockSendVerificationCode,
        verifyEmailCode: mockVerifyEmailCode
      }
    });

    const mockSnackbar = ({ title, subTitle, iconVariant }: any) => (
      <div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant} />
    );

    const mockNotificator = { success: vi.fn(), error: vi.fn() };
    const mockUseNotificator = vi.fn().mockReturnValue(mockNotificator);

    const mockExtractErrorMessage = vi.fn((error: unknown) => (error instanceof Error ? error.message : "An error occurred. Please try again."));

    const dependencies = {
      useCustomUser: mockUseCustomUser,
      useSnackbar: mockUseSnackbar,
      useServices: mockUseServices,
      Snackbar: mockSnackbar,
      useNotificator: mockUseNotificator,
      extractErrorMessage: mockExtractErrorMessage
    };

    const mockChildren = vi.fn().mockReturnValue(<div>Test</div>);
    const mockOnComplete = input.onComplete || vi.fn();

    render(
      <EmailVerificationContainer onComplete={mockOnComplete} dependencies={dependencies}>
        {mockChildren}
      </EmailVerificationContainer>
    );

    return {
      child: mockChildren,
      mockSendVerificationCode,
      mockVerifyEmailCode,
      mockCheckSession,
      mockEnqueueSnackbar,
      mockNotificator,
      mockAnalyticsService
    };
  }
});
