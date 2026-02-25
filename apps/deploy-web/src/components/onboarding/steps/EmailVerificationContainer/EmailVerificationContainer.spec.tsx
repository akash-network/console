import React from "react";
import { describe, expect, it, type Mock, vi } from "vitest";

import { EmailVerificationContainer } from "./EmailVerificationContainer";

import { act, render } from "@testing-library/react";

describe(EmailVerificationContainer.name, () => {
  it("renders children with initial state", () => {
    const { child } = setup();

    expect(child).toHaveBeenCalledWith(
      expect.objectContaining({
        isResending: false,
        isVerifying: false,
        cooldownSeconds: expect.any(Number),
        verifyError: null,
        onResendCode: expect.any(Function),
        onVerifyCode: expect.any(Function)
      })
    );
  });

  it("auto-sends code on mount when email is not verified", () => {
    const { mockSendVerificationCode } = setup();

    expect(mockSendVerificationCode).toHaveBeenCalled();
  });

  it("does not auto-send code when email is already verified", () => {
    const { mockSendVerificationCode } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    expect(mockSendVerificationCode).not.toHaveBeenCalled();
  });

  it("sets cooldown after auto-send on mount", async () => {
    const { child } = setup();

    await act(async () => {});

    const lastCall = child.mock.calls[child.mock.calls.length - 1][0];
    expect(lastCall.cooldownSeconds).toBe(60);
  });

  it("shows snackbar on user-initiated resend", async () => {
    const { child, mockSendVerificationCode, mockEnqueueSnackbar } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    mockSendVerificationCode.mockResolvedValue({});

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

  it("does not resend code while cooldown is active", async () => {
    const { child, mockSendVerificationCode } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    mockSendVerificationCode.mockResolvedValue({});

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

  it("sets cooldownSeconds after sending code", async () => {
    const { child, mockSendVerificationCode } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    mockSendVerificationCode.mockResolvedValue({});

    const { onResendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onResendCode();
    });

    const lastCall = child.mock.calls[child.mock.calls.length - 1][0];
    expect(lastCall.cooldownSeconds).toBe(60);
  });

  it("notifies error when resend code fails", async () => {
    const { child, mockSendVerificationCode, mockNotificator } = setup({
      user: { id: "test-user", emailVerified: true }
    });

    mockSendVerificationCode.mockRejectedValue(new Error("Failed"));

    const { onResendCode } = child.mock.calls[child.mock.calls.length - 1][0];
    await act(async () => {
      await onResendCode();
    });

    expect(mockNotificator.error).toHaveBeenCalledWith("Failed to send verification code. Please try again later");
  });

  it("verifies code, shows success snackbar, and auto-advances", async () => {
    const mockOnComplete = vi.fn();
    const { child, mockVerifyEmailCode, mockCheckSession, mockEnqueueSnackbar, mockAnalyticsService } = setup({ onComplete: mockOnComplete });
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
    expect(mockAnalyticsService.track).toHaveBeenCalledWith("onboarding_email_verified", { category: "onboarding" });
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("exposes verifyError on verify code failure", async () => {
    const { child, mockVerifyEmailCode } = setup();
    mockVerifyEmailCode.mockRejectedValue(new Error("Invalid verification code"));

    const { onVerifyCode } = child.mock.calls[0][0];
    await act(async () => {
      await onVerifyCode("000000");
    });

    const lastCall = child.mock.calls[child.mock.calls.length - 1][0];
    expect(lastCall.verifyError).toBe("Invalid verification code");
  });

  function setup(input: { user?: { id: string; emailVerified: boolean }; onComplete?: Mock } = {}) {
    const mockSendVerificationCode = vi.fn().mockResolvedValue({});
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

    const mockSnackbar = ({ title, subTitle, iconVariant }: { title: string; subTitle: string; iconVariant: string }) => (
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
