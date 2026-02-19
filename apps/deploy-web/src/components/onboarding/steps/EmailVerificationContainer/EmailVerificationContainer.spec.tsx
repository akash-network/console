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
        isChecking: false,
        onResendEmail: expect.any(Function),
        onCheckVerification: expect.any(Function),
        onContinue: expect.any(Function)
      })
    );
  });

  it("should handle resend email success", async () => {
    const { child, mockSendVerificationEmail, mockEnqueueSnackbar } = setup();
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const { onResendEmail } = child.mock.calls[0][0];
    await act(async () => {
      await onResendEmail();
    });

    expect(mockSendVerificationEmail).toHaveBeenCalledWith("test-user");
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Verification email sent",
          subTitle: "Please check your email and click the verification link",
          iconVariant: "success"
        })
      }),
      { variant: "success" }
    );
  });

  it("should handle resend email error", async () => {
    const { child, mockSendVerificationEmail, mockNotificator } = setup();
    mockSendVerificationEmail.mockRejectedValue(new Error("Failed"));

    const { onResendEmail } = child.mock.calls[0][0];
    await act(async () => {
      await onResendEmail();
    });

    expect(mockSendVerificationEmail).toHaveBeenCalledWith("test-user");
    expect(mockNotificator.error).toHaveBeenCalledWith("Failed to send verification email. Please try again later");
  });

  it("should handle check verification success", async () => {
    const { child, mockCheckSession, mockEnqueueSnackbar } = setup();
    mockCheckSession.mockResolvedValue(undefined);

    const { onCheckVerification } = child.mock.calls[0][0];
    await act(async () => {
      await onCheckVerification();
    });

    expect(mockCheckSession).toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({
          title: "Verification status updated",
          subTitle: "Your email verification status has been refreshed",
          iconVariant: "success"
        })
      }),
      { variant: "success" }
    );
  });

  it("should handle check verification error", async () => {
    const { child, mockCheckSession, mockNotificator } = setup();
    mockCheckSession.mockRejectedValue(new Error("Failed"));

    const { onCheckVerification } = child.mock.calls[0][0];
    await act(async () => {
      await onCheckVerification();
    });

    expect(mockCheckSession).toHaveBeenCalled();
    expect(mockNotificator.error).toHaveBeenCalledWith("Failed to check verification. Please try again or refresh the page");
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
    const mockSendVerificationEmail = vi.fn();
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
        sendVerificationEmail: mockSendVerificationEmail
      }
    });

    const mockSnackbar = ({ title, subTitle, iconVariant }: any) => (
      <div data-testid="snackbar" data-title={title} data-subtitle={subTitle} data-icon-variant={iconVariant} />
    );

    const mockNotificator = { success: vi.fn(), error: vi.fn() };
    const mockUseNotificator = vi.fn().mockReturnValue(mockNotificator);

    const dependencies = {
      useCustomUser: mockUseCustomUser,
      useSnackbar: mockUseSnackbar,
      useServices: mockUseServices,
      Snackbar: mockSnackbar,
      useNotificator: mockUseNotificator
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
      mockSendVerificationEmail,
      mockCheckSession,
      mockEnqueueSnackbar,
      mockNotificator,
      mockAnalyticsService
    };
  }
});
